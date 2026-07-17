# Klaviyo outgoing email setup

The admin compose action sends an `Appreciation Initiative Outgoing Email`
event to Klaviyo. A metric-triggered Klaviyo flow must consume that event and
send the email.

## 1. Create the private API key

Create a Klaviyo private API key with only this scope:

- `events:write`

Set it in the server environment:

```dotenv
KLAVIYO_PRIVATE_API_KEY=
```

The optional settings below normally do not need to be changed:

```dotenv
KLAVIYO_OUTGOING_EMAIL_METRIC=Appreciation Initiative Outgoing Email
KLAVIYO_API_REVISION=2026-07-15
```

Never expose the private key through a `NEXT_PUBLIC_` variable or browser code.

## 2. Create the metric and flow

1. Deploy the server environment variables.
2. Send one test email from the admin app. The first request creates the custom
   metric and test event in Klaviyo, but it cannot send an email until the flow
   exists.
3. In Klaviyo, create a flow from scratch.
4. Choose the `Appreciation Initiative Outgoing Email` metric as its trigger.
5. Add an email action with no delay.
6. Use `{{ event.subject }}` as the subject.
7. In the email body, insert the `message` event property using Klaviyo's
   personalization picker. Also use `sender_name`, `sender_email`,
   `school_name`, and `school_id` if the design needs them.
8. Configure and verify the sending and reply-to domains in Klaviyo.
9. Preview the email using the test event, then set the email action to Live.

Klaviyo accepts events asynchronously. The app therefore records an accepted
event as `queued`; a `202` response confirms API acceptance, not final email
delivery.

If these messages qualify as transactional, request transactional status for
the individual flow email in Klaviyo before going live. Klaviyo requires a paid
account and approval for that status.
