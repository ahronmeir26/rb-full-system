import { createClient } from "@supabase/supabase-js";

export const schoolUploadBucket = "school-form-uploads";
export const maxSchoolUploadBytes = 10 * 1024 * 1024;
export const maxSchoolUploadFiles = 5;

const encoder = new TextEncoder();

function uploadSecret() {
  return process.env.SCHOOL_UPLOAD_LINK_SECRET?.trim() || process.env.SUPABASE_SECRET_KEY?.trim() || "";
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function hmacKey() {
  const secret = uploadSecret();
  if (!secret) return null;
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function tokenPayload(schoolId: number, couponCode: string, version: number) {
  return `${schoolId}:${couponCode.trim().toUpperCase()}:${version}`;
}

export async function createSchoolUploadToken(schoolId: number, couponCode: string, version: number) {
  const key = await hmacKey();
  if (!key) throw new Error("School upload links are not configured.");
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!Number.isSafeInteger(schoolId) || schoolId < 1) throw new Error("A valid school is required for an upload link.");
  if (!normalizedCode) throw new Error("A coupon code is required for a school upload link.");
  if (!Number.isSafeInteger(version) || version < 1) throw new Error("A valid upload link version is required.");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(tokenPayload(schoolId, normalizedCode, version)));
  const compactSignature = base64Url(new Uint8Array(signature).slice(0, 16));
  return `${schoolId.toString(36)}-${compactSignature}`;
}

export async function parseSchoolUploadToken(token: string) {
  const match = /^([1-9a-z][0-9a-z]*)-([A-Za-z0-9_-]{22})$/.exec(token);
  if (!match) return null;
  const schoolId = Number.parseInt(match[1], 36);
  if (!Number.isSafeInteger(schoolId) || schoolId < 1) return null;
  return { schoolId, signature: match[2] };
}

export async function verifySchoolUploadToken(token: string, couponCode: string, version: number) {
  const parsed = await parseSchoolUploadToken(token);
  if (!parsed) return false;
  const expectedToken = await createSchoolUploadToken(parsed.schoolId, couponCode, version).catch(() => "");
  if (expectedToken.length !== token.length) return false;

  let mismatch = 0;
  for (let index = 0; index < expectedToken.length; index += 1) {
    mismatch |= expectedToken.charCodeAt(index) ^ token.charCodeAt(index);
  }
  return mismatch === 0;
}

export function schoolUploadAdminClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function getSchoolForUploadToken(token: string) {
  const parsed = await parseSchoolUploadToken(token);
  const supabase = schoolUploadAdminClient();
  if (!parsed || !supabase) return null;

  const { data: school, error } = await supabase
    .from("schools")
    .select("id,name,code,upload_link_version")
    .eq("id", parsed.schoolId)
    .maybeSingle();
  if (error || !school) return null;
  const valid = await verifySchoolUploadToken(token, String(school.code || ""), Number(school.upload_link_version));
  if (!valid) return null;
  return { id: Number(school.id), name: String(school.name), code: String(school.code), version: Number(school.upload_link_version) };
}

const uploadMimeTypes: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heic", "image/heif"],
};

export const schoolUploadAccept = Object.values(uploadMimeTypes).flat().join(",");

export function validateSchoolUpload(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!uploadMimeTypes[extension]?.includes(file.type)) {
    return "Upload a PDF, Word document, Excel spreadsheet, JPG, PNG, or HEIC image.";
  }
  if (file.size < 1) return "Empty files cannot be uploaded.";
  if (file.size > maxSchoolUploadBytes) return "Each file must be 10 MB or smaller.";
  return null;
}

export function cleanUploadFileName(value: string) {
  const baseName = value.normalize("NFKC").split(/[\\/]/).pop() || "form";
  const cleaned = baseName
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9._() -]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^\.+/, "")
    .trim();
  return (cleaned || "form").slice(-120);
}

export function titleForUpload(value: string) {
  return value.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 160) || "School form";
}

export async function hasValidUploadSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  if (file.type === "application/pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d);
  if (file.type === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (file.type === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (file.type === "image/heic" || file.type === "image/heif") {
    const brand = new TextDecoder().decode(bytes.slice(4, 12));
    return brand.includes("ftyp");
  }
  if (file.type.includes("openxmlformats")) return startsWith(0x50, 0x4b, 0x03, 0x04);
  if (file.type === "application/msword" || file.type === "application/vnd.ms-excel") {
    return startsWith(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
  }
  return false;
}
