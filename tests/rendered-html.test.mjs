import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { customizeAppreciationOrderForm } from "../lib/appreciation-order-form.ts";
import { mapSchool } from "../lib/map-school.ts";
import { outreachStatusTone } from "../lib/outreach-status.ts";
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
  assert.match(schema, /create or replace function public\.sync_schools_id_sequence\(\)/);
  assert.match(schema, /pg_catalog\.setval\([\s\S]*sequence_name::regclass/);
  assert.match(importer, /rpc\("sync_schools_id_sequence"\)/);
  assert.match(importer, /program_year: 2026/);
  assert.match(importer, /program_year: 2025/);
  assert.match(importer, /program_year: 2024/);
});

test("stores and manages the shared 2026 Shopify discount program", async () => {
  const [schema, editor, settingsRoute, syncRoute, shopify, functionQuery] = await Promise.all([
    readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/discounts-section.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discounts/2026/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/discounts/2026/sync/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/shopify.ts", import.meta.url), "utf8"),
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
  assert.match(shopify, /discountClasses:\s*\["PRODUCT"\]/);
  assert.match(shopify, /title:\s*program\.mainCode/);
  assert.match(shopify, /delete input\.code/);
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

test("admins can add a school and initialize its program records", async () => {
  const [editor, createRoute] = await Promise.all([
    readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/schools/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(editor, /> Add school</);
  assert.match(editor, /fetch\("\/api\/schools"/);
  assert.match(editor, /setSchools\(\(current\) => \[\.\.\.current, school\]/);
  assert.match(createRoute, /\.from\("schools"\)\s*\.insert\(/);
  assert.match(createRoute, /\.from\("school_programs"\)\.insert\(/);
  assert.match(createRoute, /\.from\("school_year_stats"\)\.insert\(/);
  assert.match(createRoute, /\.from\("school_contacts"\)\.insert\(/);
  assert.match(createRoute, /status: 201/);
});

test("new Supabase schools map missing optional fields to empty values", () => {
  const school = mapSchool({
    id: 900,
    name: "Verification Academy",
    school_type: "chassidish",
    district: null,
    city: null,
    state: null,
    code: null,
    admin: null,
    email: null,
    phone: null,
  });

  assert.equal(school.schoolType, "chassidish");
  assert.equal(school.outreachStatus, "Not contacted");
  assert.equal(school.city, "");
  assert.equal(school.email, "");
  assert.equal(school.initials, "VA");
  assert.equal(school.status, "Not started");
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
  assert.match(correspondenceRoute, /\.from\("correspondence"\)\.insert\(rows\.map\(\(row\) => row\.correspondence\)\)/);
  assert.match(correspondenceRoute, /queueKlaviyoOutgoingEmail/);
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

test("assigns semantic colors to built-in and custom outreach statuses", () => {
  assert.equal(outreachStatusTone("Not contacted"), "neutral");
  assert.equal(outreachStatusTone("Sent invite"), "info");
  assert.equal(outreachStatusTone("Not interested"), "negative");
  assert.equal(outreachStatusTone("Interested"), "positive");
  assert.equal(outreachStatusTone("Sent"), "complete");
  assert.equal(outreachStatusTone("Follow up next week"), "attention");
  assert.equal(outreachStatusTone("On hold"), "custom");
});

test("filters the school list by communication status", async () => {
  const [editor, styles] = await Promise.all([
    readFile(new URL("../app/admin-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(editor, /school\.outreachStatus === filter/);
  assert.match(editor, /<span>Communication:<\/span>/);
  assert.match(editor, /className="filter-select-value">\{filter\}<\/span>/);
  assert.match(editor, /aria-label="Filter by communication status"/);
  assert.match(editor, /outreachStatuses\.map\(\(status\) => <option/);
  assert.doesNotMatch(editor, /school\.status === filter/);
  assert.match(styles, /\.filter-select select \{ position: absolute; inset: 0; width: 100%; height: 100%;/);
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
