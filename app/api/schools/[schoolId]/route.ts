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
  const hasOutreachStatus = body && typeof body.outreachStatus === "string";
  if (!hasCode && !hasOutreachStatus) {
    return Response.json({ error: "A coupon code or outreach status is required." }, { status: 400 });
  }

  const code = hasCode ? body.code.trim() : "";
  const outreachStatus = hasOutreachStatus ? body.outreachStatus.trim() : "";
  if (hasCode && (code.length > 64 || /[\u0000-\u001f\u007f]/.test(code))) {
    return Response.json({ error: "The coupon code must be 64 characters or fewer." }, { status: 400 });
  }
  if (hasOutreachStatus && (!outreachStatus || outreachStatus.length > 64)) {
    return Response.json({ error: "A valid outreach status is required." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return Response.json({ error: "School editing requires a Supabase connection." }, { status: 503 });
  }

  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const storedCode = code || null;
  if (hasOutreachStatus) {
    const { data: status } = await supabase
      .from("school_outreach_statuses")
      .select("name")
      .eq("name", outreachStatus)
      .maybeSingle();
    if (!status) return Response.json({ error: "That outreach status does not exist." }, { status: 400 });
  }

  const updates: { code?: string | null; outreach_status?: string } = {};
  if (hasCode) updates.code = storedCode;
  if (hasOutreachStatus) updates.outreach_status = outreachStatus;
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
  }

  return Response.json({
    code: hasCode ? code : undefined,
    outreachStatus: hasOutreachStatus ? outreachStatus : undefined,
  });
}
