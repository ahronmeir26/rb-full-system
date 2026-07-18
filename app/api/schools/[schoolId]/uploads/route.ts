import { getViewer } from "@/lib/auth";
import { appUrl } from "@/lib/app-url";
import { createSchoolUploadToken, schoolUploadAdminClient, schoolUploadBucket } from "@/lib/school-upload";

function schoolIdFrom(value: string) {
  const schoolId = Number(value);
  return Number.isSafeInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

async function uploadLink(request: Request, schoolId: number, code: string, version: number) {
  const token = await createSchoolUploadToken(schoolId, code, version);
  return appUrl(`/upload/${token}`, request).toString();
}

export async function GET(request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { schoolId: rawSchoolId } = await context.params;
  const schoolId = schoolIdFrom(rawSchoolId);
  if (!schoolId) return Response.json({ error: "A valid school is required." }, { status: 400 });

  const supabase = schoolUploadAdminClient();
  if (!supabase) return Response.json({ error: "School uploads require a Supabase connection." }, { status: 503 });
  const [{ data: school, error: schoolError }, { data: submissions, error: submissionError }] = await Promise.all([
    supabase.from("schools").select("id,code,upload_link_version").eq("id", schoolId).maybeSingle(),
    supabase
      .from("form_submissions")
      .select("id,title,file_name,storage_path,mime_type,file_size_bytes,status,submitted_at")
      .eq("school_id", schoolId)
      .neq("status", "archived")
      .order("submitted_at", { ascending: false }),
  ]);
  if (schoolError || submissionError) {
    console.error("Unable to load school uploads", schoolError || submissionError);
    return Response.json({ error: "Unable to load this school's uploads." }, { status: 500 });
  }
  if (!school) return Response.json({ error: "School not found." }, { status: 404 });

  const files = await Promise.all((submissions || []).map(async (submission) => {
    const { data } = await supabase.storage.from(schoolUploadBucket).createSignedUrl(submission.storage_path, 60 * 60);
    return {
      id: submission.id,
      title: submission.title,
      fileName: submission.file_name,
      mimeType: submission.mime_type,
      fileSizeBytes: submission.file_size_bytes,
      status: submission.status,
      submittedAt: submission.submitted_at,
      downloadUrl: data?.signedUrl || null,
    };
  }));
  const code = String(school.code || "").trim();
  return Response.json({
    uploadLink: code ? await uploadLink(request, schoolId, code, Number(school.upload_link_version || 1)) : null,
    requiresCouponCode: !code,
    files,
  });
}

export async function POST(request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { schoolId: rawSchoolId } = await context.params;
  const schoolId = schoolIdFrom(rawSchoolId);
  if (!schoolId) return Response.json({ error: "A valid school is required." }, { status: 400 });

  const supabase = schoolUploadAdminClient();
  if (!supabase) return Response.json({ error: "School uploads require a Supabase connection." }, { status: 503 });
  const { data: school, error: lookupError } = await supabase
    .from("schools")
    .select("id,code,upload_link_version")
    .eq("id", schoolId)
    .maybeSingle();
  if (lookupError || !school) return Response.json({ error: lookupError ? "Unable to rotate the upload link." : "School not found." }, { status: lookupError ? 500 : 404 });
  const code = String(school.code || "").trim();
  if (!code) return Response.json({ error: "Assign a coupon code before creating an upload link." }, { status: 400 });

  const currentVersion = Number(school.upload_link_version || 1);
  const nextVersion = currentVersion + 1;
  const { data: updated, error } = await supabase
    .from("schools")
    .update({ upload_link_version: nextVersion })
    .eq("id", schoolId)
    .eq("upload_link_version", currentVersion)
    .select("upload_link_version")
    .maybeSingle();
  if (error || !updated) {
    console.error("Unable to rotate school upload link", error);
    return Response.json({ error: "The link changed at the same time. Refresh and try again." }, { status: 409 });
  }
  return Response.json({ uploadLink: await uploadLink(request, schoolId, code, Number(updated.upload_link_version)) });
}
