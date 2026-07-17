import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: { params: Promise<{ correspondenceId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { correspondenceId } = await context.params;
  if (!uuidPattern.test(correspondenceId)) {
    return Response.json({ error: "A valid message is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "resolve" && action !== "reopen") {
    return Response.json({ error: "The action must be resolve or reopen." }, { status: 400 });
  }

  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return Response.json({ error: "Correspondence requires a Supabase connection." }, { status: 503 });
  const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: message, error: loadError } = await supabase
    .from("correspondence")
    .select("id,direction,channel")
    .eq("id", correspondenceId)
    .maybeSingle();
  if (loadError) {
    console.error("Unable to load the message to resolve", loadError);
    return Response.json({ error: "Unable to update the message." }, { status: 500 });
  }
  if (!message) return Response.json({ error: "Message not found." }, { status: 404 });
  if (message.direction !== "inbound" || message.channel !== "email") {
    return Response.json({ error: "Only incoming emails can be resolved." }, { status: 400 });
  }

  const updates = action === "resolve"
    ? { resolved_at: new Date().toISOString(), resolved_by: viewer.id, resolution: "no_reply_needed" }
    : { resolved_at: null, resolved_by: null, resolution: null };
  const { data: updated, error } = await supabase
    .from("correspondence")
    .update(updates)
    .eq("id", correspondenceId)
    .select("id,direction,channel,subject,body,from_email,to_email,status,contacted_at,resolved_at,resolution")
    .single();
  if (error || !updated) {
    console.error("Unable to update the message resolution", error);
    return Response.json({ error: "Unable to update the message." }, { status: 500 });
  }

  return Response.json({ message: updated });
}
