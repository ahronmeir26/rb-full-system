import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { gmailConfigFromEnvironment, gmailConfigured } from "@/lib/gmail-sync";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const config = gmailConfigFromEnvironment();
  if (!gmailConfigured(config)) {
    return Response.json({ configured: false, connected: false });
  }
  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("gmail_email,status,messages_synced,last_synced_at,last_sync_error")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (error) {
    console.error("Unable to load Gmail status", error);
    return Response.json({ error: "Unable to load Gmail status." }, { status: 500 });
  }
  return Response.json({ configured: true, connected: Boolean(data), connection: data || null });
}
