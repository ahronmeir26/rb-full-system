import {
  cleanUploadFileName,
  getSchoolForUploadToken,
  hasValidUploadSignature,
  maxSchoolUploadFiles,
  schoolUploadAdminClient,
  schoolUploadBucket,
  titleForUpload,
  validateSchoolUpload,
} from "@/lib/school-upload";

const responseHeaders = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const school = await getSchoolForUploadToken(token);
  if (!school) return Response.json({ error: "This upload link is invalid or no longer active." }, { status: 404, headers: responseHeaders });
  return Response.json({ schoolName: school.name, couponCode: school.code }, { headers: responseHeaders });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const school = await getSchoolForUploadToken(token);
  const supabase = schoolUploadAdminClient();
  if (!school) return Response.json({ error: "This upload link is invalid or no longer active." }, { status: 404, headers: responseHeaders });
  if (!supabase) return Response.json({ error: "Uploads are temporarily unavailable." }, { status: 503, headers: responseHeaders });

  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "The upload could not be read." }, { status: 400, headers: responseHeaders });
  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (!files.length) return Response.json({ error: "Choose at least one file to upload." }, { status: 400, headers: responseHeaders });
  if (files.length > maxSchoolUploadFiles) {
    return Response.json({ error: `Upload no more than ${maxSchoolUploadFiles} files at a time.` }, { status: 400, headers: responseHeaders });
  }

  for (const file of files) {
    const validationError = validateSchoolUpload(file);
    if (validationError) return Response.json({ error: `${file.name}: ${validationError}` }, { status: 400, headers: responseHeaders });
    if (!await hasValidUploadSignature(file)) {
      return Response.json({ error: `${file.name} does not appear to be a valid ${file.name.split(".").pop()?.toUpperCase() || "document"} file.` }, { status: 400, headers: responseHeaders });
    }
  }

  const uploadedPaths: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  for (const file of files) {
    const fileName = cleanUploadFileName(file.name);
    const storagePath = `${school.id}/2026/${crypto.randomUUID()}-${fileName}`;
    const { error } = await supabase.storage
      .from(schoolUploadBucket)
      .upload(storagePath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) {
      console.error("Unable to store school form", error);
      if (uploadedPaths.length) await supabase.storage.from(schoolUploadBucket).remove(uploadedPaths);
      return Response.json({ error: "The files could not be saved. Please try again." }, { status: 500, headers: responseHeaders });
    }
    uploadedPaths.push(storagePath);
    rows.push({
      school_id: school.id,
      program_year: 2026,
      submitted_by: null,
      title: titleForUpload(fileName),
      file_name: fileName,
      storage_path: storagePath,
      mime_type: file.type,
      file_size_bytes: file.size,
      status: "submitted",
    });
  }

  const { data: submissions, error: insertError } = await supabase
    .from("form_submissions")
    .insert(rows)
    .select("id,file_name,submitted_at");
  if (insertError) {
    console.error("Unable to record school form submission", insertError);
    await supabase.storage.from(schoolUploadBucket).remove(uploadedPaths);
    return Response.json({ error: "The upload could not be recorded. Please try again." }, { status: 500, headers: responseHeaders });
  }
  return Response.json({ submissions }, { status: 201, headers: responseHeaders });
}
