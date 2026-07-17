import { OAuth2Client } from "google-auth-library";
import { gmailConfigFromEnvironment, syncAllGmailConnections } from "@/lib/gmail-sync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const tokenVerifier = new OAuth2Client();

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function schedulerIsAuthorized(request: Request) {
  const token = bearerToken(request);
  const audience = process.env.CLOUD_RUN_SERVICE_URL;
  const expectedEmail = process.env.GMAIL_SYNC_SERVICE_ACCOUNT;
  if (!token || !audience || !expectedEmail) return false;

  try {
    const ticket = await tokenVerifier.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    return payload?.email_verified === true &&
      payload.email?.toLowerCase() === expectedEmail.toLowerCase();
  } catch (error) {
    console.warn("Rejected Gmail scheduler token", error);
    return false;
  }
}

export async function POST(request: Request) {
  if (!await schedulerIsAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await syncAllGmailConnections(gmailConfigFromEnvironment());
    return Response.json(result);
  } catch (error) {
    console.error("Scheduled Gmail synchronization failed", error);
    return Response.json({ error: "Gmail synchronization failed." }, { status: 500 });
  }
}
