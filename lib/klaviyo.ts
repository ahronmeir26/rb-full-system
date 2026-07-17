export type KlaviyoRuntimeConfig = {
  privateApiKey: string;
  revision: string;
  outgoingEmailMetric: string;
};

export type KlaviyoOutgoingEmail = {
  eventId: string;
  toEmail: string;
  subject: string;
  message: string;
  senderEmail: string;
  senderName: string;
  schoolId: number;
  schoolName: string;
};

export const DEFAULT_KLAVIYO_REVISION = "2026-07-15";
export const DEFAULT_OUTGOING_EMAIL_METRIC = "Appreciation Initiative Outgoing Email";

export function klaviyoConfigFromEnvironment(
  environment: Record<string, string | undefined> = process.env,
): KlaviyoRuntimeConfig {
  return {
    privateApiKey: environment.KLAVIYO_PRIVATE_API_KEY?.trim() || "",
    revision: environment.KLAVIYO_API_REVISION?.trim() || DEFAULT_KLAVIYO_REVISION,
    outgoingEmailMetric:
      environment.KLAVIYO_OUTGOING_EMAIL_METRIC?.trim() || DEFAULT_OUTGOING_EMAIL_METRIC,
  };
}

export function klaviyoConfigured(config = klaviyoConfigFromEnvironment()) {
  return Boolean(config.privateApiKey && config.outgoingEmailMetric);
}

export function klaviyoOutgoingEmailPayload(
  email: KlaviyoOutgoingEmail,
  config: KlaviyoRuntimeConfig,
) {
  return {
    data: {
      type: "event",
      attributes: {
        properties: {
          subject: email.subject,
          message: email.message,
          sender_email: email.senderEmail,
          sender_name: email.senderName,
          school_id: email.schoolId,
          school_name: email.schoolName,
          source: "appreciation-initiative-admin",
        },
        metric: {
          data: {
            type: "metric",
            attributes: { name: config.outgoingEmailMetric },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: { email: email.toEmail },
          },
        },
        unique_id: email.eventId,
      },
    },
  };
}

function apiErrorDetail(value: unknown) {
  if (!value || typeof value !== "object" || !("errors" in value) || !Array.isArray(value.errors)) {
    return "";
  }
  return value.errors
    .map((error) => {
      if (!error || typeof error !== "object") return "";
      if ("detail" in error && typeof error.detail === "string") return error.detail;
      if ("title" in error && typeof error.title === "string") return error.title;
      return "";
    })
    .filter(Boolean)
    .join(" ");
}

export class KlaviyoRequestError extends Error {
  status: number;

  constructor(status: number, detail = "") {
    super(`Klaviyo request failed (${status}).${detail ? ` ${detail}` : ""}`);
    this.name = "KlaviyoRequestError";
    this.status = status;
  }
}

export async function queueKlaviyoOutgoingEmail(
  email: KlaviyoOutgoingEmail,
  config = klaviyoConfigFromEnvironment(),
  fetcher: typeof fetch = fetch,
) {
  if (!klaviyoConfigured(config)) {
    throw new Error("KLAVIYO_PRIVATE_API_KEY is not configured.");
  }

  const response = await fetcher("https://a.klaviyo.com/api/events", {
    method: "POST",
    headers: {
      accept: "application/vnd.api+json",
      authorization: `Klaviyo-API-Key ${config.privateApiKey}`,
      "content-type": "application/vnd.api+json",
      revision: config.revision,
    },
    body: JSON.stringify(klaviyoOutgoingEmailPayload(email, config)),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new KlaviyoRequestError(response.status, apiErrorDetail(result));
  }

  return { eventId: email.eventId };
}
