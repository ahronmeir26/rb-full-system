import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { mapSchool } from "@/lib/map-school";
import { loadSchools } from "@/lib/school-data";
import type { SchoolType } from "@/lib/types";

const schoolTypes = new Set<SchoolType>(["regular", "chassidish"]);
const avatarColors = ["mint", "blue", "peach", "violet", "gold", "rose"];

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const result = await loadSchools();
  return Response.json(result);
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  const text = value.trim().replace(/\s+/g, " ");
  return text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = cleanText(body?.name, 160);
  const district = cleanText(body?.district, 120);
  const city = cleanText(body?.city, 120);
  const state = cleanText(body?.state, 64);
  const code = cleanText(body?.code, 64);
  const admin = cleanText(body?.admin, 160);
  const email = cleanText(body?.email, 254);
  const phone = cleanText(body?.phone, 64);
  const outreachStatus = cleanText(body?.outreachStatus, 64);
  const schoolType = typeof body?.schoolType === "string" ? body.schoolType as SchoolType : "regular";
  const students = body?.students === "" || body?.students == null ? 0 : Number(body.students);

  if (!name) return Response.json({ error: "A school name is required and must be 160 characters or fewer." }, { status: 400 });
  if ([district, city, state, code, admin, email, phone, outreachStatus].some((value) => value === null)) {
    return Response.json({ error: "One or more fields is too long or contains invalid characters." }, { status: 400 });
  }
  if (!schoolTypes.has(schoolType)) {
    return Response.json({ error: "A valid school type is required." }, { status: 400 });
  }
  if (!outreachStatus) {
    return Response.json({ error: "A status is required." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid administrator email address." }, { status: 400 });
  }
  if (!Number.isInteger(students) || students < 0 || students > 1_000_000) {
    return Response.json({ error: "Student count must be a whole number between 0 and 1,000,000." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return Response.json({ error: "Adding schools requires a Supabase connection." }, { status: 503 });
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const [statusLookup, codeLookup] = await Promise.all([
    supabase.from("school_outreach_statuses").select("name").eq("name", outreachStatus).maybeSingle(),
    code
      ? supabase.from("schools").select("id,name").ilike("code", code).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (statusLookup.error || codeLookup.error) {
    console.error("Unable to validate the new school", statusLookup.error || codeLookup.error);
    return Response.json({ error: "Unable to validate the school." }, { status: 500 });
  }
  if (!statusLookup.data) return Response.json({ error: "That status does not exist." }, { status: 400 });
  if (codeLookup.data) {
    return Response.json({ error: `That 2026 code is already assigned to ${codeLookup.data.name}.` }, { status: 409 });
  }

  const { data: schoolRow, error: schoolError } = await supabase
    .from("schools")
    .insert({
      name,
      school_type: schoolType,
      district: district || null,
      city: city || null,
      state: state || null,
      outreach_status: outreachStatus,
      code: code || null,
      admin: admin || null,
      email: email || null,
      phone: phone || null,
      students,
      progress: 0,
      initials: initialsFor(name),
      color: avatarColors[Math.floor(Math.random() * avatarColors.length)],
    })
    .select("*")
    .single();

  if (schoolError || !schoolRow) {
    console.error("Unable to create school", schoolError);
    if (schoolError?.code === "23505" && code) {
      return Response.json({ error: "That 2026 code is already assigned to another school." }, { status: 409 });
    }
    return Response.json({ error: "Unable to add the school." }, { status: 500 });
  }

  const relatedWrites = [
    supabase.from("school_programs").insert({
      school_id: schoolRow.id,
      program_year: 2026,
      school_code: code || null,
      eligible: true,
      status: "Not started",
      progress: 0,
    }),
    supabase.from("school_year_stats").insert(
      [2026, 2025, 2024].map((programYear) => ({
        school_id: schoolRow.id,
        program_year: programYear,
        school_code: programYear === 2026 ? code || null : null,
        order_count: 0,
      })),
    ),
  ];
  if (email) {
    relatedWrites.push(supabase.from("school_contacts").insert({
      school_id: schoolRow.id,
      name: admin || null,
      email,
      phone: phone || null,
      title: "Program Administrator",
      is_primary: true,
    }));
  }
  const relatedResults = await Promise.all(relatedWrites);
  const relatedError = relatedResults.find((result) => result.error)?.error;
  if (relatedError) {
    console.error("Unable to create related school records", relatedError);
    await supabase.from("schools").delete().eq("id", schoolRow.id);
    return Response.json({ error: "Unable to finish adding the school." }, { status: 500 });
  }

  if (code) {
    const { data: discountProgram } = await supabase
      .from("discount_programs")
      .select("id")
      .eq("program_year", 2026)
      .maybeSingle();
    if (discountProgram) {
      const { error: discountError } = await supabase.from("discount_school_codes").upsert({
        discount_program_id: discountProgram.id,
        school_id: schoolRow.id,
        program_year: 2026,
        code: code.toUpperCase(),
        shopify_redeem_code_id: null,
        sync_status: "pending",
        last_synced_at: null,
        last_sync_error: null,
      }, { onConflict: "school_id,program_year" });
      if (discountError) {
        console.error("Unable to queue the new school discount code for Shopify", discountError);
      } else {
        await supabase.from("discount_programs").update({ sync_status: "pending" }).eq("id", discountProgram.id);
      }
    }
  }

  return Response.json({ school: mapSchool(schoolRow) }, { status: 201 });
}
