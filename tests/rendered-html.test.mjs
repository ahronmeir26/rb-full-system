import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { customizeAppreciationOrderForm } from "../lib/appreciation-order-form.ts";
import { initial2026SchoolCode } from "../lib/school-code.ts";
import { cartLinesDiscountsGenerateRun } from "../shopify/extensions/appreciation-product-discounts/src/cart_lines_discounts_generate_run.js";

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
  assert.match(html, /<title>Appreciation Initiative — Admin<\/title>/i);
  assert.match(html, /Appreciation Initiative/);
  assert.match(html, /Admin portal/);
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
    "school_outreach_statuses",
    "school_outreach_status_history",
    "form_templates",
    "form_submissions",
    "correspondence",
    "invitation_campaigns",
    "invitation_recipients",
    "discount_programs",
    "discount_school_codes",
    "order_submissions",
  ]) {
    assert.match(schema, new RegExp(`create table if not exists public\\.${table}`));
  }

  assert.match(schema, /enable row level security/);
  assert.match(schema, /shopify_order_id text/);
  assert.match(schema, /school_type text not null default 'regular'/);
  assert.match(schema, /check \(school_type in \('regular', 'chassidish'\)\)/);
  assert.match(schema, /update public\.schools set school_type = 'regular' where school_type is null/);
  assert.match(schema, /delete from public\.user_profiles where role = 'school_admin'/);
  assert.match(schema, /update public\.user_profiles set role = 'admin' where role = 'program_admin'/);
  assert.match(schema, /check \(role = 'admin'\)/);
  assert.match(loader, /from\("schools"\)\.select\("\*"\)/);
  assert.match(importer, /school_type: school\.schoolType \|\| "regular"/);
  assert.match(importer, /program_year: 2026/);
  assert.match(importer, /program_year: 2025/);
  assert.match(importer, /program_year: 2024/);
});

test("stores and manages the shared 2026 Shopify discount program", async () => {
  const [schema, editor, settingsRoute, syncRoute, functionQuery] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/discounts-section.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discounts/2026/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discounts/2026/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../shopify/extensions/appreciation-product-discounts/src/cart_lines_discounts_generate_run.graphql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /mens_discount_value numeric/);
  assert.match(schema, /boys_discount_value numeric/);
  assert.match(schema, /shopify_discount_id text/);
  assert.match(schema, /unique \(program_year, code\)/);
  assert.match(editor, /Pre-order men's shirts/);
  assert.match(editor, /Pre-order boys' shirts/);
  assert.match(editor, /Sync all 2026 codes/);
  assert.doesNotMatch(editor, /Combination rules/);
  assert.doesNotMatch(editor, /Allow other discounts/);
  assert.match(settingsRoute, /\.from\("discount_programs"\)/);
  assert.match(syncRoute, /syncShopifyDiscount/);
  assert.match(functionQuery, /inMensCollection: inAnyCollection/);
  assert.match(functionQuery, /inBoysCollection: inAnyCollection/);
});

test("Shopify function applies independent men's and boys' discounts", () => {
  const result = cartLinesDiscountsGenerateRun({
    cart: {
      lines: [
        { id: "mens-line", merchandise: { __typename: "ProductVariant", inMensCollection: true, inBoysCollection: false } },
        { id: "boys-line", merchandise: { __typename: "ProductVariant", inMensCollection: false, inBoysCollection: true } },
        { id: "other-line", merchandise: { __typename: "ProductVariant", inMensCollection: false, inBoysCollection: false } },
      ],
    },
    discount: {
      metafield: {
        jsonValue: {
          mensDiscount: { type: "percentage", value: 25 },
          boysDiscount: { type: "fixed_amount", value: 8.5 },
        },
      },
    },
  });
  const operation = result.operations[0].productDiscountsAdd;
  assert.equal(operation.selectionStrategy, "ALL");
  assert.equal(operation.candidates.length, 2);
  assert.deepEqual(operation.candidates[0].value, { percentage: { value: "25.00" } });
  assert.deepEqual(operation.candidates[1].value, { fixedAmount: { amount: "8.50", appliesToEachItem: true } });
  assert.deepEqual(operation.candidates[0].targets, [{ cartLine: { id: "mens-line" } }]);
  assert.deepEqual(operation.candidates[1].targets, [{ cartLine: { id: "boys-line" } }]);
});

test("2026 coupon codes start blank and remain admin-editable", async () => {
  const [seed, workbookImporter, supabaseSync, editor, updateRoute] = await Promise.all([
    readFile(new URL("../app/school-data.generated.json", import.meta.url), "utf8"),
    readFile(new URL("../scripts/import_school_workbook.py", import.meta.url), "utf8"),
    readFile(new URL("../scripts/sync_schools_to_supabase.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/schools/[schoolId]/route.ts", import.meta.url), "utf8"),
  ]);

  const schools = JSON.parse(seed);
  assert.ok(schools.length > 0);
  assert.ok(schools.every((school) => school.code === ""));
  assert.match(workbookImporter, /"code": ""/);
  assert.doesNotMatch(supabaseSync, /^\s+code: school\.code/m);
  assert.match(editor, /2026 coupon code/);
  assert.match(editor, /Edit school/);
  assert.match(updateRoute, /\.update\(updates\)/);
});

test("supports custom outreach statuses and complete contact history", async () => {
  const [schema, editor, correspondenceRoute, statusRoute] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/correspondence/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/outreach-statuses/route.ts", import.meta.url), "utf8"),
  ]);

  for (const status of ["Not contacted", "Sent invite", "Not interested", "Interested", "Sent"]) {
    assert.match(schema, new RegExp(`'${status}'`));
  }
  assert.match(schema, /foreign key \(outreach_status\) references public\.school_outreach_statuses\(name\)/);
  assert.match(schema, /record_school_outreach_status/);
  assert.match(schema, /contacted_at timestamptz not null default now\(\)/);
  assert.match(schema, /update_school_last_contacted_at/);
  assert.match(editor, /Create a custom status/);
  assert.match(editor, /Complete history/);
  assert.match(correspondenceRoute, /\.from\("correspondence"\)\.insert\(rows\)/);
  assert.match(statusRoute, /\.from\("school_outreach_statuses"\)/);
});

test("keeps pre-engagement outreach separate and hides program status from the school table", async () => {
  const [schema, editor] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /\('Not contacted', true, 0\)/);
  assert.match(schema, /outreach_status set default 'Not contacted'/);
  assert.doesNotMatch(editor, /<th>Program status<\/th>/);
});

test("school details participate in browser back and forward navigation", async () => {
  const editor = await readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8");
  assert.match(editor, /history\.pushState/);
  assert.match(editor, /addEventListener\("popstate"/);
  assert.match(editor, /history\.back\(\)/);
  assert.match(editor, /searchParams\.set\("school"/);
  assert.match(editor, /returningSchoolIdRef/);
});

test("prefills an unsaved 2026 school code from a 2025 code ending in 25", () => {
  assert.equal(initial2026SchoolCode({ code: "", code2025: "YESHIVA25" }), "YESHIVA26");
  assert.equal(initial2026SchoolCode({ code: "", code2025: "YESHIVA250" }), "");
  assert.equal(initial2026SchoolCode({ code: "", code2025: "YESHIVA24" }), "");
  assert.equal(initial2026SchoolCode({ code: "CUSTOM26", code2025: "YESHIVA25" }), "CUSTOM26");
});

test("overview omits the bulk and shortcut email buttons", async () => {
  const editor = await readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(editor, /Email one school/);
  assert.doesNotMatch(editor, /Email every school/);
  assert.doesNotMatch(editor, /BulkEmailModal/);
});

test("overview keeps compact program stats in the welcome heading without the contact banner", async () => {
  const editor = await readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8");
  assert.match(editor, /className="page-heading overview-heading"/);
  assert.match(editor, /className="stats-grid"/);
  assert.match(editor, /className="source-badge schools-source-badge"/);
  assert.doesNotMatch(editor, /className="attention-card"/);
  assert.doesNotMatch(editor, /schools need contact information/);
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
