import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { mapEmailTemplate, validateEmailTemplate } from "@/lib/email-template";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Email templates require a Supabase connection." }, { status: 503 });

  const { data, error } = await supabase
    .from("email_templates")
    .select("id,name,subject,body,sort_order")
    .order("sort_order")
    .order("name");
  if (error) {
    console.error("Unable to load email templates", error);
    return Response.json({ error: "Unable to load email templates." }, { status: 500 });
  }

  return Response.json({ templates: (data ?? []).map(mapEmailTemplate) });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const input = validateEmailTemplate(await request.json().catch(() => null));
  if ("error" in input) return Response.json({ error: input.error }, { status: 400 });

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Email templates require a Supabase connection." }, { status: 503 });

  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      name: input.name,
      subject: input.subject,
      body: input.body,
      sort_order: input.sortOrder,
      created_by: viewer.id,
      updated_by: viewer.id,
    })
    .select("id,name,subject,body,sort_order")
    .single();
  if (error) {
    console.error("Unable to create email template", error);
    const duplicate = error.code === "23505";
    return Response.json(
      { error: duplicate ? "A template with that name already exists." : "Unable to create the email template." },
      { status: duplicate ? 409 : 500 },
    );
  }

  return Response.json({ template: mapEmailTemplate(data) }, { status: 201 });
}
