import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decryptGmailToken } from "@/lib/gmail-crypto";

export type GmailRuntimeConfig = {
  supabaseUrl: string;
  supabaseSecretKey: string;
  googleClientId: string;
  googleClientSecret: string;
  tokenEncryptionKey: string;
};

type GmailConnection = {
  id: string;
  user_id: string;
  gmail_email: string;
  encrypted_refresh_token: string;
  history_id: string | null;
  initial_sync_complete: boolean;
  status: "connected" | "syncing" | "error";
  last_sync_started_at: string | null;
};

type GmailHeader = { name?: string; value?: string };
type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};
type GmailMessage = {
  id: string;
  historyId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};
type SchoolMatch = { id: number; emails: Set<string>; domains: Set<string> };

const personalDomains = new Set([
  "aol.com", "gmail.com", "googlemail.com", "hotmail.com", "icloud.com",
  "live.com", "mail.com", "me.com", "msn.com", "outlook.com", "proton.me",
  "protonmail.com", "yahoo.com", "ymail.com",
]);
const decoder = new TextDecoder();

export function gmailConfigFromEnvironment(environment: Record<string, string | undefined> = process.env) {
  return {
    supabaseUrl: environment.SUPABASE_URL || "",
    supabaseSecretKey: environment.SUPABASE_SECRET_KEY || "",
    googleClientId: environment.GOOGLE_CLIENT_ID || "",
    googleClientSecret: environment.GOOGLE_CLIENT_SECRET || "",
    tokenEncryptionKey: environment.GMAIL_TOKEN_ENCRYPTION_KEY || "",
  } satisfies GmailRuntimeConfig;
}

export function gmailConfigured(config = gmailConfigFromEnvironment()) {
  return Boolean(
    config.supabaseUrl && config.supabaseSecretKey && config.googleClientId &&
    config.googleClientSecret && config.tokenEncryptionKey,
  );
}

function serviceClient(config: GmailRuntimeConfig) {
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function emailDomain(email: string) {
  const at = email.lastIndexOf("@");
  return at > -1 ? email.slice(at + 1) : "";
}

export function extractEmailAddresses(value: string) {
  const addresses = new Set<string>();
  for (const match of value.matchAll(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    addresses.add(normalizeEmail(match[0]));
  }
  return [...addresses];
}

function header(message: GmailMessage, name: string) {
  return message.payload?.headers?.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return decoder.decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function findBody(part: GmailPart | undefined, mimeType: string): string {
  if (!part) return "";
  if (part.mimeType === mimeType && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts || []) {
    const body = findBody(child, mimeType);
    if (body) return body;
  }
  return "";
}

function messageBody(part?: GmailPart) {
  const plain = findBody(part, "text/plain").trim();
  return plain || htmlToText(findBody(part, "text/html"));
}

async function gmailFetch<T>(accessToken: string, path: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`Gmail request failed (${response.status}). ${detail.slice(0, 300)}`);
    Object.assign(error, { status: response.status });
    throw error;
  }
  return response.json() as Promise<T>;
}

async function refreshAccessToken(connection: GmailConnection, config: GmailRuntimeConfig) {
  const refreshToken = await decryptGmailToken(connection.encrypted_refresh_token, config.tokenEncryptionKey);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  const result = await response.json().catch(() => null) as { access_token?: string; error?: string } | null;
  if (!response.ok || !result?.access_token) {
    throw new Error(result?.error === "invalid_grant"
      ? "Gmail access was revoked. Reconnect Gmail in Settings."
      : "Unable to refresh Gmail access.");
  }
  return result.access_token;
}

async function loadSchoolMatches(supabase: SupabaseClient) {
  const [{ data: schools, error: schoolError }, { data: contacts, error: contactError }] = await Promise.all([
    supabase.from("schools").select("id,email"),
    supabase.from("school_contacts").select("school_id,email"),
  ]);
  if (schoolError || contactError) throw new Error("Unable to load school email addresses.");

  const byId = new Map<number, SchoolMatch>();
  for (const school of schools || []) {
    const match = { id: Number(school.id), emails: new Set<string>(), domains: new Set<string>() };
    if (school.email) match.emails.add(normalizeEmail(school.email));
    byId.set(match.id, match);
  }
  for (const contact of contacts || []) {
    const match = byId.get(Number(contact.school_id));
    if (match && contact.email) match.emails.add(normalizeEmail(contact.email));
  }

  const domainOwners = new Map<string, Set<number>>();
  for (const match of byId.values()) {
    for (const email of match.emails) {
      const domain = emailDomain(email);
      if (!domain || personalDomains.has(domain)) continue;
      const owners = domainOwners.get(domain) || new Set<number>();
      owners.add(match.id);
      domainOwners.set(domain, owners);
    }
  }
  for (const match of byId.values()) {
    for (const email of match.emails) {
      const domain = emailDomain(email);
      if (domainOwners.get(domain)?.size === 1) match.domains.add(domain);
    }
  }
  return [...byId.values()].filter((match) => match.emails.size);
}

function schoolsForMessage(message: GmailMessage, schools: SchoolMatch[]) {
  const participants = new Set([
    ...extractEmailAddresses(header(message, "from")),
    ...extractEmailAddresses(header(message, "to")),
    ...extractEmailAddresses(header(message, "cc")),
    ...extractEmailAddresses(header(message, "bcc")),
    ...extractEmailAddresses(header(message, "reply-to")),
  ]);
  const domains = new Set([...participants].map(emailDomain));
  return schools.filter((school) =>
    [...school.emails].some((email) => participants.has(email)) ||
    [...school.domains].some((domain) => domains.has(domain)),
  );
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

async function listInitialMessageIds(accessToken: string, schools: SchoolMatch[]) {
  const exactEmails = [...new Set(schools.flatMap((school) => [...school.emails]))];
  const domains = [...new Set(schools.flatMap((school) => [...school.domains]))];
  const searchTerms = [
    ...exactEmails.map((email) => `from:${email} OR to:${email} OR cc:${email}`),
    ...domains.map((domain) => `from:(@${domain}) OR to:(@${domain}) OR cc:(@${domain})`),
  ];
  const ids = new Set<string>();

  for (const group of chunks(searchTerms, 12)) {
    let pageToken: string | undefined;
    do {
      const parameters = new URLSearchParams({ maxResults: "500", q: `{${group.join(" ")}}` });
      if (pageToken) parameters.set("pageToken", pageToken);
      const page = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
        accessToken,
        `/messages?${parameters}`,
      );
      for (const message of page.messages || []) ids.add(message.id);
      pageToken = page.nextPageToken;
    } while (pageToken);
  }

  const profile = await gmailFetch<{ historyId?: string }>(accessToken, "/profile");
  return { ids: [...ids], historyId: profile.historyId || null };
}

async function listIncrementalMessageIds(accessToken: string, historyId: string) {
  const ids = new Set<string>();
  let pageToken: string | undefined;
  let newestHistoryId = historyId;
  do {
    const parameters = new URLSearchParams({
      startHistoryId: historyId,
      historyTypes: "messageAdded",
      maxResults: "500",
    });
    if (pageToken) parameters.set("pageToken", pageToken);
    const page = await gmailFetch<{
      history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }>;
      historyId?: string;
      nextPageToken?: string;
    }>(accessToken, `/history?${parameters}`);
    for (const event of page.history || []) {
      for (const added of event.messagesAdded || []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }
    newestHistoryId = page.historyId || newestHistoryId;
    pageToken = page.nextPageToken;
  } while (pageToken);
  return { ids: [...ids], historyId: newestHistoryId };
}

async function getMessages(accessToken: string, ids: string[]) {
  const messages: GmailMessage[] = [];
  for (const group of chunks(ids, 12)) {
    messages.push(...await Promise.all(group.map((id) =>
      gmailFetch<GmailMessage>(accessToken, `/messages/${encodeURIComponent(id)}?format=full`),
    )));
  }
  return messages;
}

async function importMessages(
  supabase: SupabaseClient,
  gmailEmail: string,
  messages: GmailMessage[],
  schools: SchoolMatch[],
) {
  let imported = 0;
  const mailbox = normalizeEmail(gmailEmail);
  for (const group of chunks(messages, 100)) {
    const rows = group.flatMap((message) => {
      const fromAddresses = extractEmailAddresses(header(message, "from"));
      const toAddresses = [
        ...extractEmailAddresses(header(message, "to")),
        ...extractEmailAddresses(header(message, "cc")),
      ];
      const isOutbound = fromAddresses.includes(mailbox);
      const contactedAt = message.internalDate && Number.isFinite(Number(message.internalDate))
        ? new Date(Number(message.internalDate)).toISOString()
        : new Date().toISOString();
      const body = (messageBody(message.payload) || message.snippet || "(No message body)").slice(0, 100_000);
      return schoolsForMessage(message, schools).map((school) => ({
        school_id: school.id,
        direction: isOutbound ? "outbound" : "inbound",
        channel: "email",
        subject: header(message, "subject") || null,
        body,
        from_email: fromAddresses.join(", ") || null,
        to_email: toAddresses.join(", ") || null,
        status: isOutbound ? "sent" : "received",
        external_message_id: message.id,
        contacted_at: contactedAt,
        sent_at: isOutbound ? contactedAt : null,
        received_at: isOutbound ? null : contactedAt,
      }));
    });
    if (!rows.length) continue;
    const { data, error } = await supabase
      .from("correspondence")
      .upsert(rows, { onConflict: "school_id,external_message_id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`Unable to save Gmail correspondence: ${error.message}`);
    imported += data?.length || 0;
  }
  return imported;
}

export async function syncGmailConnection(connection: GmailConnection, config: GmailRuntimeConfig) {
  const supabase = serviceClient(config);
  const startedAt = new Date().toISOString();
  const previousStart = connection.last_sync_started_at
    ? new Date(connection.last_sync_started_at).getTime()
    : 0;
  if (connection.status === "syncing" && Date.now() - previousStart < 10 * 60_000) {
    return { imported: 0, checked: 0, skipped: true };
  }

  await supabase
    .from("gmail_connections")
    .update({ status: "syncing", last_sync_started_at: startedAt, last_sync_error: null })
    .eq("id", connection.id);

  try {
    const accessToken = await refreshAccessToken(connection, config);
    const schools = await loadSchoolMatches(supabase);
    let listing: { ids: string[]; historyId: string | null };
    try {
      listing = connection.initial_sync_complete && connection.history_id
        ? await listIncrementalMessageIds(accessToken, connection.history_id)
        : await listInitialMessageIds(accessToken, schools);
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error;
      listing = await listInitialMessageIds(accessToken, schools);
    }
    const messages = await getMessages(accessToken, listing.ids);
    const imported = await importMessages(supabase, connection.gmail_email, messages, schools);
    const { error: updateError } = await supabase.rpc("complete_gmail_sync", {
      connection_id: connection.id,
      imported_count: imported,
      latest_history_id: listing.historyId,
      completed_at: new Date().toISOString(),
    });
    if (updateError) throw updateError;
    return { imported, checked: listing.ids.length, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Gmail synchronization failed.";
    await supabase
      .from("gmail_connections")
      .update({ status: "error", last_sync_error: message })
      .eq("id", connection.id);
    throw error;
  }
}

export async function syncGmailForUser(userId: string, config = gmailConfigFromEnvironment()) {
  if (!gmailConfigured(config)) throw new Error("Gmail is not configured.");
  const supabase = serviceClient(config);
  const { data, error } = await supabase
    .from("gmail_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Unable to load Gmail connection.");
  if (!data) throw new Error("Connect Gmail before synchronizing.");
  return syncGmailConnection(data as GmailConnection, config);
}

export async function syncAllGmailConnections(config: GmailRuntimeConfig) {
  if (!gmailConfigured(config)) return { synchronized: 0, imported: 0 };
  const supabase = serviceClient(config);
  const { data, error } = await supabase.from("gmail_connections").select("*");
  if (error) throw new Error("Unable to load Gmail connections.");
  let synchronized = 0;
  let imported = 0;
  for (const connection of (data || []) as GmailConnection[]) {
    try {
      const result = await syncGmailConnection(connection, config);
      if (!result.skipped) synchronized += 1;
      imported += result.imported;
    } catch (error) {
      console.error("Unable to synchronize Gmail connection", connection.id, error);
    }
  }
  return { synchronized, imported };
}
