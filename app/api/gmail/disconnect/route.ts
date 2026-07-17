import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { decryptGmailToken } from "@/lib/gmail-crypto";
import { gmailConfigFromEnvironment, gmailConfigured } from "@/lib/gmail-sync";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const config = gmailConfigFromEnvironment();
  if (!gmailConfigured(config)) return Response.json({ error: "Gmail is not configured." }, { status: 503 });

  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await supabase
    .from("gmail_connections")
    .select("encrypted_refresh_token")
    .eq("user_id", viewer.id)
    .maybeSingle();
  if (data?.encrypted_refresh_token) {
    try {
      const token = await decryptGmailToken(data.encrypted_refresh_token, config.tokenEncryptionKey);
      await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
      });
    } catch (error) {
      console.error("Unable to revoke Gmail access", error);
    }
  }
  const { error } = await supabase.from("gmail_connections").delete().eq("user_id", viewer.id);
  if (error) return Response.json({ error: "Unable to disconnect Gmail." }, { status: 500 });
  return Response.json({ disconnected: true });
}
