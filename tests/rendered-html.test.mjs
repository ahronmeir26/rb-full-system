import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { customizeAppreciationOrderForm } from "../lib/appreciation-order-form.ts";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Appreciation Initiative application", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Appreciation Initiative — Program Operations<\/title>/i);
  assert.match(html, /Appreciation Initiative/);
  assert.match(html, /Secure portal/);
  assert.match(html, /Sign in/);
});

test("database schema covers the complete school-program workflow", async () => {
  const [schema, loader, importer] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../lib/school-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync_schools_to_supabase.mjs", import.meta.url), "utf8"),
  ]);

  for (const table of [
    "schools",
    "school_contacts",
    "school_programs",
    "school_year_stats",
    "form_templates",
    "form_submissions",
    "correspondence",
    "invitation_campaigns",
    "invitation_recipients",
    "order_submissions",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
  }

  assert.match(schema, /enable row level security/);
  assert.match(schema, /shopify_order_id text/);
  assert.match(loader, /from\("schools"\)\.select\("\*"\)/);
  assert.match(importer, /program_year: 2026/);
  assert.match(importer, /program_year: 2025/);
  assert.match(importer, /program_year: 2024/);
});

test("generates a four-page appreciation order form for a school's coupon code", async () => {
  const template = await readFile(new URL("../assets/forms/ai-stone-appreciation-order-form-template.pdf", import.meta.url));
  const customized = await customizeAppreciationOrderForm(template, "PESACH26-TEST");
  const pdf = await PDFDocument.load(customized);

  assert.equal(pdf.getPageCount(), 4);
  assert.match(pdf.getSubject() ?? "", /coupon code PESACH26-TEST/);
  assert.match(pdf.getKeywords() ?? "", /coupon:PESACH26-TEST/);
  await assert.rejects(() => customizeAppreciationOrderForm(template, "   "), /coupon code is required/i);
});
