# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Klaviyo outgoing email

Admin-composed email is queued through a Klaviyo custom event and delivered by
a metric-triggered Klaviyo flow. See [docs/klaviyo-setup.md](docs/klaviyo-setup.md)
for the API-key scope, environment variables, and required flow configuration.

## Shopify setup

This project uses a new Dev Dashboard app and Shopify's client credentials
grant. It does not use a permanent Admin API access token.

1. Create the app and target development store in the same organization in the
   Shopify Dev Dashboard.
2. Add the required `read_products` and `write_discounts` access scopes. For a
   broad development/test installation that can exercise the planned order and
   fulfillment workflow, use:

   ```text
   read_products,write_products,read_discounts,write_discounts,
   read_orders,write_orders,read_draft_orders,write_draft_orders,
   read_order_edits,write_order_edits,read_customers,write_customers,
   read_inventory,write_inventory,read_locations,read_shipping,
   read_returns,write_returns,read_merchant_managed_fulfillment_orders,
   write_merchant_managed_fulfillment_orders
   ```

   The order and customer scopes involve protected customer data. Configure
   the app's protected-customer-data access in Shopify before testing those
   APIs. Add `read_all_orders` only if tests must read orders older than 60
   days; Shopify requires separate approval for that scope.
3. Release the app version, install it on the store, and approve its scopes.
4. Set `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_CLIENT_ID`, and
   `SHOPIFY_CLIENT_SECRET` in the server environment. Tokens are requested
   programmatically, cached, and refreshed before their 24-hour expiry.
5. Link the local Shopify Function to the app with
   `shopify app config link --client-id <client-id>`, then deploy it with
   `shopify app deploy`. Set the deployed Function ID as
   `SHOPIFY_DISCOUNT_FUNCTION_ID`.

The client credentials grant only works when the app and store belong to the
same Shopify organization. Never expose `SHOPIFY_CLIENT_SECRET` to browser
code or commit it to source control.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
