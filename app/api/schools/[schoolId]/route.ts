import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import type { SchoolType } from "@/lib/types";

const schoolTypes = new Set<SchoolType>(["regular", "chassidish"]);

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const text = value.trim().replace(/\s+/g, " ");
  return text.length <= maxLength && !/[\u0000-\u001f\u007f]/.test(text) ? text : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { schoolId: rawSchoolId } = await context.params;
  const schoolId = Number(rawSchoolId);
  if (!Number.isInteger(schoolId) || schoolId < 1) {
    return Response.json({ error: "A valid school is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const hasCode = body && typeof body.code === "string";
  const hasName = body && typeof body.name === "string";
  const hasOutreachStatus = body && typeof body.outreachStatus === "string";
  const hasNeedsFollowUp = body && typeof body.needsFollowUp === "boolean";
  const hasSchoolType = body && typeof body.schoolType === "string";
  const hasDistrict = body && typeof body.district === "string";
  const hasCity = body && typeof body.city === "string";
  const hasState = body && typeof body.state === "string";
  const hasAdmin = body && typeof body.admin === "string";
  const hasEmail = body && typeof body.email === "string";
  const hasPhone = body && typeof body.phone === "string";
  const hasStudents = body && (typeof body.students === "string" || typeof body.students === "number");
  if (!hasCode && !hasName && !hasOutreachStatus && !hasNeedsFollowUp && !hasSchoolType && !hasDistrict && !hasCity && !hasState && !hasAdmin && !hasEmail && !hasPhone && !hasStudents) {
    return Response.json({ error: "A school update is required." }, { status: 400 });
  }

  const code = hasCode ? cleanText(body.code, 64) : "";
  const name = hasName ? cleanText(body.name, 160) : "";
  const outreachStatus = hasOutreachStatus ? cleanText(body.outreachStatus, 64) : "";
  const district = hasDistrict ? cleanText(body.district, 120) : "";
  const city = hasCity ? cleanText(body.city, 120) : "";
  const state = hasState ? cleanText(body.state, 64) : "";
  const admin = hasAdmin ? cleanText(body.admin, 160) : "";
  const email = hasEmail ? cleanText(body.email, 254) : "";
  const phone = hasPhone ? cleanText(body.phone, 64) : "";
  const schoolType = hasSchoolType ? body.schoolType as SchoolType : "regular";
  const students = hasStudents ? (body.students === "" ? 0 : Number(body.students)) : 0;
  if (hasCode && code === null) return Response.json({ error: "The coupon code must be 64 characters or fewer." }, { status: 400 });
  if (hasName && (!name || name.length > 160)) {
    return Response.json({ error: "A school name of 160 characters or fewer is required." }, { status: 400 });
  }
  if (hasOutreachStatus && !outreachStatus) {
    return Response.json({ error: "A valid status is required." }, { status: 400 });
  }
  if ([district, city, state, admin, email, phone].some((value) => value === null)) return Response.json({ error: "One or more fields is invalid." }, { status: 400 });
  if (hasSchoolType && !schoolTypes.has(schoolType)) return Response.json({ error: "A valid school type is required." }, { status: 400 });
  if (hasEmail && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid administrator email address." }, { status: 400 });
  if (hasStudents && (!Number.isInteger(students) || students < 0 || students > 1_000_000)) return Response.json({ error: "Student count must be a whole number between 0 and 1,000,000." }, { status: 400 });
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return Response.json({ error: "School editing requires a Supabase connection." }, { status: 503 });
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const storedCode = code || null;
  if (hasCode && storedCode) {
    const { data: duplicate } = await supabase
      .from("schools")
      .select("id,name")
      .ilike("code", storedCode)
      .neq("id", schoolId)
      .maybeSingle();
    if (duplicate) {
      return Response.json({ error: `That 2026 code is already assigned to ${duplicate.name}.` }, { status: 409 });
    }
  }
  if (hasOutreachStatus) {
    const { data: status } = await supabase
      .from("school_outreach_statuses")
      .select("name")
      .eq("name", outreachStatus)
      .maybeSingle();
    if (!status) return Response.json({ error: "That status does not exist." }, { status: 400 });
  }

  const updates: Record<string, string | number | boolean | null> = {};
  if (hasName) updates.name = name;
  if (hasCode) updates.code = storedCode;
  if (hasOutreachStatus) updates.outreach_status = outreachStatus;
  if (hasNeedsFollowUp) updates.needs_follow_up = body.needsFollowUp;
  if (hasSchoolType) updates.school_type = schoolType;
  if (hasDistrict) updates.district = district || null;
  if (hasCity) updates.city = city || null;
  if (hasState) updates.state = state || null;
  if (hasAdmin) updates.admin = admin || null;
  if (hasEmail) updates.email = email || null;
  if (hasPhone) updates.phone = phone || null;
  if (hasStudents) updates.students = students;
  const { data: school, error } = await supabase
    .from("schools")
    .update(updates)
    .eq("id", schoolId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Unable to update school coupon code", error);
    return Response.json({ error: "Unable to save the school." }, { status: 500 });
  }
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  if (hasCode) {
    const [programResult, statsResult] = await Promise.all([
      supabase.from("school_programs").update({ school_code: storedCode }).eq("school_id", schoolId).eq("program_year", 2026),
      supabase.from("school_year_stats").update({ school_code: storedCode }).eq("school_id", schoolId).eq("program_year", 2026),
    ]);
    if (programResult.error || statsResult.error) {
      console.error("Unable to synchronize normalized 2026 school code", programResult.error || statsResult.error);
    }
    const { data: discountProgram } = await supabase
      .from("discount_programs")
      .select("id")
      .eq("program_year", 2026)
      .maybeSingle();
    if (discountProgram && storedCode) {
      const { error: syncError } = await supabase.from("discount_school_codes").upsert({
        discount_program_id: discountProgram.id,
        school_id: schoolId,
        program_year: 2026,
        code: storedCode.toUpperCase(),
        shopify_redeem_code_id: null,
        sync_status: "pending",
        last_synced_at: null,
        last_sync_error: null,
      }, { onConflict: "school_id,program_year" });
      if (syncError) console.error("Unable to queue the school discount code for Shopify", syncError);
    } else if (discountProgram && !storedCode) {
      await supabase
        .from("discount_school_codes")
        .delete()
        .eq("discount_program_id", discountProgram.id)
        .eq("school_id", schoolId);
    }
    if (discountProgram) {
      await supabase.from("discount_programs").update({ sync_status: "pending" }).eq("id", discountProgram.id);
    }
  }

  return Response.json({
    ...(hasName ? { name } : {}), ...(hasCode ? { code } : {}), ...(hasOutreachStatus ? { outreachStatus } : {}), ...(hasNeedsFollowUp ? { needsFollowUp: body.needsFollowUp } : {}),
    ...(hasSchoolType ? { schoolType } : {}), ...(hasDistrict ? { district } : {}), ...(hasCity ? { city } : {}), ...(hasState ? { state } : {}), ...(hasAdmin ? { admin } : {}), ...(hasEmail ? { email } : {}), ...(hasPhone ? { phone } : {}), ...(hasStudents ? { students } : {}),
  });
}
