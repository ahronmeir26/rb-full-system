import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";

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
  if (!hasCode && !hasName && !hasOutreachStatus && !hasNeedsFollowUp) {
    return Response.json({ error: "A school update is required." }, { status: 400 });
  }

  const code = hasCode ? body.code.trim() : "";
  const name = hasName ? body.name.trim() : "";
  const outreachStatus = hasOutreachStatus ? body.outreachStatus.trim() : "";
  if (hasCode && (code.length > 64 || /[\u0000-\u001f\u007f]/.test(code))) {
    return Response.json({ error: "The coupon code must be 64 characters or fewer." }, { status: 400 });
  }
  if (hasName && (!name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name))) {
    return Response.json({ error: "A school name of 160 characters or fewer is required." }, { status: 400 });
  }
  if (hasOutreachStatus && (!outreachStatus || outreachStatus.length > 64)) {
    return Response.json({ error: "A valid status is required." }, { status: 400 });
  }
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

  const updates: { name?: string; code?: string | null; outreach_status?: string; needs_follow_up?: boolean } = {};
  if (hasName) updates.name = name;
  if (hasCode) updates.code = storedCode;
  if (hasOutreachStatus) updates.outreach_status = outreachStatus;
  if (hasNeedsFollowUp) updates.needs_follow_up = body.needsFollowUp;
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
    name: hasName ? name : undefined,
    code: hasCode ? code : undefined,
    outreachStatus: updates.outreach_status,
    needsFollowUp: updates.needs_follow_up,
  });
}
