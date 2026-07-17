import { getViewer } from "@/lib/auth";
import { syncGmailForUser } from "@/lib/gmail-sync";

export async function POST() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    return Response.json(await syncGmailForUser(viewer.id));
  } catch (error) {
    console.error("Unable to synchronize Gmail", error);
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to synchronize Gmail.",
    }, { status: 500 });
  }
}
