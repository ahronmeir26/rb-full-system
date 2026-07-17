import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_KLAVIYO_REVISION,
  DEFAULT_OUTGOING_EMAIL_METRIC,
  KlaviyoRequestError,
  klaviyoConfigFromEnvironment,
  klaviyoOutgoingEmailPayload,
  queueKlaviyoOutgoingEmail,
} from "../lib/klaviyo.ts";

const email = {
  eventId: "4b5d3f33-2e21-4c1c-b392-2dae2a74a2ed",
  toEmail: "administrator@school.edu",
  subject: "Forms and next steps",
  message: "Hello,\n\nPlease review the forms.",
  senderEmail: "admin@appreciation.test",
  senderName: "Program Admin",
  schoolId: 42,
  schoolName: "Verification Academy",
};

test("uses a minimal Klaviyo server configuration", () => {
  assert.deepEqual(klaviyoConfigFromEnvironment({ KLAVIYO_PRIVATE_API_KEY: " private-key " }), {
    privateApiKey: "private-key",
    revision: DEFAULT_KLAVIYO_REVISION,
    outgoingEmailMetric: DEFAULT_OUTGOING_EMAIL_METRIC,
  });
});

test("builds an idempotent metric-triggered outgoing email event", () => {
  const config = klaviyoConfigFromEnvironment({ KLAVIYO_PRIVATE_API_KEY: "private-key" });
  const payload = klaviyoOutgoingEmailPayload(email, config);

  assert.equal(payload.data.type, "event");
  assert.equal(payload.data.attributes.unique_id, email.eventId);
  assert.equal(payload.data.attributes.profile.data.attributes.email, email.toEmail);
  assert.equal(payload.data.attributes.metric.data.attributes.name, DEFAULT_OUTGOING_EMAIL_METRIC);
  assert.equal(payload.data.attributes.properties.subject, email.subject);
  assert.equal(payload.data.attributes.properties.message, email.message);
});

test("queues outgoing email through the Klaviyo Events API", async () => {
  const config = klaviyoConfigFromEnvironment({ KLAVIYO_PRIVATE_API_KEY: "private-key" });
  let request;
  const fetcher = async (url, init) => {
    request = { url, init };
    return new Response(null, { status: 202 });
  };

  assert.deepEqual(await queueKlaviyoOutgoingEmail(email, config, fetcher), { eventId: email.eventId });
  assert.equal(request.url, "https://a.klaviyo.com/api/events");
  assert.equal(request.init.headers.authorization, "Klaviyo-API-Key private-key");
  assert.equal(request.init.headers.revision, DEFAULT_KLAVIYO_REVISION);
  assert.deepEqual(JSON.parse(request.init.body), klaviyoOutgoingEmailPayload(email, config));
});

test("surfaces a sanitized Klaviyo API error", async () => {
  const config = klaviyoConfigFromEnvironment({ KLAVIYO_PRIVATE_API_KEY: "private-key" });
  const fetcher = async () => Response.json(
    { errors: [{ title: "Invalid input.", detail: "The email address is invalid." }] },
    { status: 400 },
  );

  await assert.rejects(
    () => queueKlaviyoOutgoingEmail(email, config, fetcher),
    (error) => error instanceof KlaviyoRequestError &&
      error.status === 400 &&
      /email address is invalid/i.test(error.message) &&
      !error.message.includes("private-key"),
  );
});
