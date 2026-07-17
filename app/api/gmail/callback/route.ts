import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { encryptGmailToken } from "@/lib/gmail-crypto";
import { gmailConfigFromEnvironment, gmailConfigured } from "@/lib/gmail-sync";

const stateCookie = "appreciation-gmail-oauth-state";

function redirect(request: Request, result: string) {
  return Response.redirect(new URL(`/?gmail=${encodeURIComponent(result)}`, request.url));
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return redirect(request, "auth-required");
  const config = gmailConfigFromEnvironment();
  if (!gmailConfigured(config)) return redirect(request, "setup-required");

  const url = new URL(request.url);
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(stateCookie)?.value;
  cookieStore.delete(stateCookie);
  if (!expectedState || url.searchParams.get("state") !== expectedState) {
    return redirect(request, "invalid-state");
  }
  const code = url.searchParams.get("code");
  if (!code || url.searchParams.has("error")) return redirect(request, "cancelled");

  const redirectUri = process.env.GMAIL_REDIRECT_URI || new URL("/api/gmail/callback", request.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const tokens = await tokenResponse.json().catch(() => null) as {
    access_token?: string;
    refresh_token?: string;
  } | null;
  if (!tokenResponse.ok || !tokens?.access_token) return redirect(request, "token-error");

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => null) as {
    emailAddress?: string;
  } | null;
  if (!profileResponse.ok || !profile?.emailAddress) return redirect(request, "profile-error");

  const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing } = await supabase
    .from("gmail_connections")
    .select("encrypted_refresh_token")
    .eq("user_id", viewer.id)
    .maybeSingle();
  const encryptedRefreshToken = tokens.refresh_token
    ? await encryptGmailToken(tokens.refresh_token, config.tokenEncryptionKey)
    : existing?.encrypted_refresh_token;
  if (!encryptedRefreshToken) return redirect(request, "refresh-token-error");

  const { error } = await supabase.from("gmail_connections").upsert({
    user_id: viewer.id,
    gmail_email: profile.emailAddress.toLowerCase(),
    encrypted_refresh_token: encryptedRefreshToken,
    history_id: null,
    initial_sync_complete: false,
    status: "connected",
    last_sync_error: null,
  }, { onConflict: "user_id" });
  if (error) {
    console.error("Unable to save Gmail connection", error);
    return redirect(request, "save-error");
  }
  return redirect(request, "connected");
}
