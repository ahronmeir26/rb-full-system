import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { mapEmailTemplate, validateEmailTemplate } from "@/lib/email-template";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

async function templateIdFrom(context: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await context.params;
  return uuidPattern.test(templateId) ? templateId : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ templateId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const templateId = await templateIdFrom(context);
  if (!templateId) return Response.json({ error: "A valid email template is required." }, { status: 400 });

  const input = validateEmailTemplate(await request.json().catch(() => null));
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Email templates require a Supabase connection." }, { status: 503 });

  const { data, error } = await supabase
    .from("email_templates")
    .update({
      name: input.name,
      subject: input.subject,
      body: input.body,
      sort_order: input.sortOrder,
      updated_by: viewer.id,
    })
    .eq("id", templateId)
    .select("id,name,subject,body,sort_order")
    .maybeSingle();
  if (error) {
    console.error("Unable to update email template", error);
    const duplicate = error.code === "23505";
    return Response.json(
      { error: duplicate ? "A template with that name already exists." : "Unable to update the email template." },
      { status: duplicate ? 409 : 500 },
    );
  }
  if (!data) return Response.json({ error: "Email template not found." }, { status: 404 });

  return Response.json({ template: mapEmailTemplate(data) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ templateId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const templateId = await templateIdFrom(context);
  if (!templateId) return Response.json({ error: "A valid email template is required." }, { status: 400 });

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Email templates require a Supabase connection." }, { status: 503 });

  const { data, error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", templateId)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Unable to delete email template", error);
    return Response.json({ error: "Unable to delete the email template." }, { status: 500 });
  }
  if (!data) return Response.json({ error: "Email template not found." }, { status: 404 });

  return new Response(null, { status: 204 });
}
