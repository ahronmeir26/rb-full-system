import { cookies } from "next/headers";
import { appUrl } from "@/lib/app-url";
import { getViewer } from "@/lib/auth";
import { gmailConfigured } from "@/lib/gmail-sync";

const stateCookie = "appreciation-gmail-oauth-state";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.redirect(appUrl("/", request));
  if (!gmailConfigured()) {
    return Response.redirect(appUrl("/?gmail=setup-required", request));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(stateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: appUrl("/", request).protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  });

  const redirectUri = process.env.GMAIL_REDIRECT_URI || appUrl("/api/gmail/callback", request).toString();
  const parameters = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${parameters}`);
}
