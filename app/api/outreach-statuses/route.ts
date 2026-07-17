import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 64 || /[\u0000-\u001f\u007f]/.test(name)) {
    return Response.json({ error: "Status names must be between 1 and 64 characters." }, { status: 400 });
  }

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Status editing requires a Supabase connection." }, { status: 503 });

  const { data: existing } = await supabase
    .from("school_outreach_statuses")
    .select("name,is_system")
    .ilike("name", name)
    .maybeSingle();
  if (existing) return Response.json({ name: existing.name, isSystem: existing.is_system });

  const { data, error } = await supabase
    .from("school_outreach_statuses")
    .insert({ name, created_by: viewer.id })
    .select("name,is_system")
    .single();
  if (error) {
    console.error("Unable to create outreach status", error);
    return Response.json({ error: "Unable to create the status." }, { status: 500 });
  }

  return Response.json({ name: data.name, isSystem: data.is_system }, { status: 201 });
}
