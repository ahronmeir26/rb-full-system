import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { gmailConfigured } from "@/lib/gmail-sync";

const stateCookie = "appreciation-gmail-oauth-state";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.redirect(new URL("/", request.url));
  if (!gmailConfigured()) {
    return Response.redirect(new URL("/?gmail=setup-required", request.url));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(stateCookie, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  });

  const redirectUri = process.env.GMAIL_REDIRECT_URI || new URL("/api/gmail/callback", request.url).toString();
  const parameters = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    login_hint: viewer.email,
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${parameters}`);
}
