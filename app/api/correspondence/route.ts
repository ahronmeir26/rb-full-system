import { createClient } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import {
  klaviyoConfigFromEnvironment,
  klaviyoConfigured,
  queueKlaviyoOutgoingEmail,
  type KlaviyoOutgoingEmail,
} from "@/lib/klaviyo";

function serviceClient() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return null;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const schoolId = Number(new URL(request.url).searchParams.get("schoolId"));
  if (!Number.isInteger(schoolId) || schoolId < 1) {
    return Response.json({ error: "A valid school is required." }, { status: 400 });
  }

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Correspondence requires a Supabase connection." }, { status: 503 });

  const { data, error } = await supabase
    .from("correspondence")
    .select("id,direction,channel,subject,body,from_email,to_email,status,contacted_at")
    .eq("school_id", schoolId)
    .order("contacted_at", { ascending: false });
  if (error) {
    console.error("Unable to load correspondence", error);
    return Response.json({ error: "Unable to load correspondence." }, { status: 500 });
  }

  return Response.json({ correspondence: data });
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const schoolIds = Array.isArray(body?.schoolIds)
    ? [...new Set(body.schoolIds.map(Number).filter((id: number) => Number.isInteger(id) && id > 0))]
    : [];
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!schoolIds.length || schoolIds.length > 1000) {
    return Response.json({ error: "Between 1 and 1,000 schools are required." }, { status: 400 });
  }
  if (!subject || subject.length > 250 || !message || message.length > 20_000) {
    return Response.json({ error: "A subject and message are required." }, { status: 400 });
  }

  const klaviyoConfig = klaviyoConfigFromEnvironment();
  if (!klaviyoConfigured(klaviyoConfig)) {
    return Response.json({ error: "Outgoing email requires a configured Klaviyo private API key." }, { status: 503 });
  }

  const supabase = serviceClient();
  if (!supabase) return Response.json({ error: "Correspondence requires a Supabase connection." }, { status: 503 });

  const { data: schools, error: schoolError } = await supabase
    .from("schools")
    .select("id,name,email")
    .in("id", schoolIds);
  if (schoolError) {
    console.error("Unable to load correspondence recipients", schoolError);
    return Response.json({ error: "Unable to load recipients." }, { status: 500 });
  }

  const contactedAt = new Date().toISOString();
  const rows = (schools ?? [])
    .filter((school) => school.email?.includes("@"))
    .map((school) => {
      const eventId = crypto.randomUUID();
      return {
        correspondence: {
          id: crypto.randomUUID(),
          school_id: school.id,
          direction: "outbound",
          channel: "email",
          subject,
          body: message,
          from_email: viewer.email,
          to_email: school.email,
          status: "queued",
          external_message_id: eventId,
          contacted_at: contactedAt,
          sent_at: null,
          created_by: viewer.id,
        },
        klaviyo: {
          eventId,
          toEmail: school.email,
          subject,
          message,
          senderEmail: viewer.email,
          senderName: viewer.displayName,
          schoolId: Number(school.id),
          schoolName: school.name,
        } satisfies KlaviyoOutgoingEmail,
      };
    });
  if (!rows.length) return Response.json({ error: "No selected schools have an email address." }, { status: 400 });

  const { error } = await supabase.from("correspondence").insert(rows.map((row) => row.correspondence));
  if (error) {
    console.error("Unable to record correspondence", error);
    return Response.json({ error: "Unable to record correspondence." }, { status: 500 });
  }

  const results: Array<{ id: string; accepted: boolean; error?: unknown }> = [];
  for (let index = 0; index < rows.length; index += 25) {
    const batch = rows.slice(index, index + 25);
    results.push(...await Promise.all(batch.map(async (row) => {
      try {
        await queueKlaviyoOutgoingEmail(row.klaviyo, klaviyoConfig);
        return { id: row.correspondence.id, accepted: true };
      } catch (error) {
        console.error("Unable to queue Klaviyo email event", row.klaviyo.eventId, error);
        return { id: row.correspondence.id, accepted: false, error };
      }
    })));
  }

  const failedIds = results.filter((result) => !result.accepted).map((result) => result.id);
  if (failedIds.length) {
    const { error: updateError } = await supabase
      .from("correspondence")
      .update({ status: "failed" })
      .in("id", failedIds);
    if (updateError) console.error("Unable to mark failed Klaviyo correspondence", updateError);
  }

  const queued = results.length - failedIds.length;
  if (!queued) {
    return Response.json({ error: "Klaviyo could not queue the email.", queued: 0, failed: failedIds.length }, { status: 502 });
  }
  return Response.json(
    { queued, failed: failedIds.length, contactedAt },
    { status: failedIds.length ? 207 : 202 },
  );
}
