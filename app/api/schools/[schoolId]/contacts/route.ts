import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function schoolIdFrom(context: { params: Promise<{ schoolId: string }> }) {
  const { schoolId: rawSchoolId } = await context.params;
  const schoolId = Number(rawSchoolId);
  return Number.isInteger(schoolId) && schoolId > 0 ? schoolId : null;
}

export async function GET(_request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const schoolId = await schoolIdFrom(context);
  if (!schoolId) return Response.json({ error: "A valid school is required." }, { status: 400 });
  const supabase = serviceClient();
  if (!supabase) return Response.json({ contacts: [] });

  const { data, error } = await supabase
    .from("school_contacts")
    .select("id,name,email,phone,title,is_primary")
    .eq("school_id", schoolId)
    .order("is_primary", { ascending: false })
    .order("name");
  if (error) return Response.json({ error: "Unable to load contacts." }, { status: 500 });
  return Response.json({ contacts: data ?? [] });
}

export async function POST(request: Request, context: { params: Promise<{ schoolId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const schoolId = await schoolIdFrom(context);
  if (!schoolId) return Response.json({ error: "A valid school is required." }, { status: 400 });
  const input = await request.json().catch(() => null);
  const name = typeof input?.name === "string" ? input.name.trim().slice(0, 160) : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase().slice(0, 254) : "";
  const phone = typeof input?.phone === "string" ? input.phone.trim().slice(0, 64) : "";
  const title = typeof input?.title === "string" ? input.title.trim().slice(0, 100) : "Program contact";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Contacts require a Supabase connection." }, { status: 503 });
  const { data, error } = await supabase
    .from("school_contacts")
    .upsert({ school_id: schoolId, name: name || null, email, phone: phone || null, title: title || "Program contact", is_primary: false }, { onConflict: "school_id,email" })
    .select("id,name,email,phone,title,is_primary")
    .single();
  if (error) return Response.json({ error: "Unable to save contact." }, { status: 500 });
  return Response.json({ contact: data }, { status: 201 });
}
