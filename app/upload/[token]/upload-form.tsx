"use client";

import { CheckCircle2, FileText, ShieldCheck, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

const maxSchoolUploadFiles = 5;
const schoolUploadAccept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,.heif";

function readableSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SchoolUploadForm({ token, schoolName, couponCode }: { token: string; schoolName: string; couponCode: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

  function choose(nextFiles: File[]) {
    setUploadedCount(0);
    setError(nextFiles.length > maxSchoolUploadFiles ? `Choose no more than ${maxSchoolUploadFiles} files.` : "");
    setFiles(nextFiles.slice(0, maxSchoolUploadFiles));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!files.length) return setError("Choose at least one file.");
    setLoading(true);
    setError("");
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const response = await fetch(`/api/public/school-uploads/${encodeURIComponent(token)}`, { method: "POST", body: formData });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return setError(result?.error || "The files could not be uploaded. Please try again.");
    setUploadedCount(result?.submissions?.length || files.length);
    setFiles([]);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (uploadedCount) {
    return <div className="school-upload-success">
      <span><CheckCircle2 size={34} /></span>
      <h2>Upload complete</h2>
      <p>{uploadedCount === 1 ? "Your form is" : `${uploadedCount} forms are`} now attached to {schoolName}&apos;s school record.</p>
      <button type="button" className="secondary-button" onClick={() => setUploadedCount(0)}>Upload more forms</button>
    </div>;
  }

  return <form className="school-upload-form" onSubmit={submit}>
    <div className="school-upload-context"><span>School</span><strong>{schoolName}</strong><small>Coupon code: {couponCode}</small></div>
    <button
      type="button"
      className={`school-upload-dropzone ${dragging ? "dragging" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(Array.from(event.dataTransfer.files)); }}
    >
      <span className="school-upload-icon"><Upload size={25} /></span>
      <strong>Choose forms to upload</strong>
      <small>or drag and drop them here</small>
      <em>PDF, Word, Excel, JPG, PNG, or HEIC · 10 MB each</em>
    </button>
    <input ref={inputRef} className="sr-only" type="file" name="files" multiple accept={schoolUploadAccept} onChange={(event) => choose(Array.from(event.target.files || []))} />
    {files.length > 0 && <div className="school-upload-file-list">{files.map((file, index) => <div key={`${file.name}-${file.lastModified}`}>
      <span><FileText size={17} /></span><p><strong>{file.name}</strong><small>{readableSize(file.size)}</small></p>
      <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X size={15} /></button>
    </div>)}</div>}
    {error && <p className="school-upload-error" role="alert">{error}</p>}
    <button className="primary-button school-upload-submit" disabled={loading || !files.length}><ShieldCheck size={17} /> {loading ? "Uploading securely…" : `Upload ${files.length || ""} ${files.length === 1 ? "form" : "forms"}`}</button>
    <p className="school-upload-privacy"><ShieldCheck size={13} /> Files are sent securely and can only be viewed by the program team.</p>
  </form>;
}
