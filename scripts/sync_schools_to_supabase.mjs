import fs from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required.");

const schools = JSON.parse(await fs.readFile(new URL("../app/school-data.generated.json", import.meta.url), "utf8"));
const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

const rows = schools.map((school) => ({
  id: school.id,
  name: school.name,
  school_type: school.schoolType || "regular",
  district: school.district || null,
  city: school.city || null,
  state: school.state || null,
  code_2025: school.code2025 || null,
  code_2024: school.code2024 || null,
  admin: school.admin || null,
  email: school.email || null,
  phone: school.phone || null,
  students: school.students,
  orders_2026: school.orders2026,
  orders_2025: school.orders2025,
  orders_2024: school.orders2024,
  program_stage: school.status === "Complete" ? "Complete"
    : school.orders2026 > 0 || school.status === "In progress" ? "Ordered"
      : "Not invited",
  progress: school.progress,
  eligibility: school.eligibility || null,
  last_contact: school.lastContact || null,
  initials: school.initials,
  color: school.color,
  updated_at: new Date().toISOString(),
}));

for (let index = 0; index < rows.length; index += 100) {
  const { error } = await supabase.from("schools").upsert(rows.slice(index, index + 100), { onConflict: "id" });
  if (error) throw error;
}

// Explicit IDs do not advance PostgreSQL's identity sequence. Keep the next
// admin-created school above the highest imported workbook ID.
const { error: sequenceError } = await supabase.rpc("sync_schools_id_sequence");
if (sequenceError) throw sequenceError;

const contacts = rows
  .filter((school) => school.email?.includes("@"))
  .map((school) => ({
    school_id: school.id,
    name: school.admin || null,
    email: school.email,
    phone: school.phone || null,
    title: "Program Administrator",
    is_primary: true,
  }));

const schoolPrograms = rows.map((school) => ({
  school_id: school.id,
  program_year: 2026,
  eligible: true,
  eligibility_note: school.eligibility || null,
  status: school.status,
  progress: school.progress,
}));

const yearlyStats = rows.flatMap((school) => [
  { school_id: school.id, program_year: 2026, order_count: school.orders_2026 },
  { school_id: school.id, program_year: 2025, school_code: school.code_2025 || null, order_count: school.orders_2025 },
  { school_id: school.id, program_year: 2024, school_code: school.code_2024 || null, order_count: school.orders_2024 },
]);

async function upsertInBatches(table, values, onConflict) {
  for (let index = 0; index < values.length; index += 100) {
    const { error } = await supabase
      .from(table)
      .upsert(values.slice(index, index + 100), { onConflict });
    if (error) throw error;
  }
}

await upsertInBatches("school_contacts", contacts, "school_id,email");
await upsertInBatches("school_programs", schoolPrograms, "school_id,program_year");
await upsertInBatches("school_year_stats", yearlyStats, "school_id,program_year");

console.log(JSON.stringify({
  schools: rows.length,
  contacts: contacts.length,
  yearlyStats: yearlyStats.length,
  orderTotals: {
    2026: rows.reduce((sum, school) => sum + school.orders_2026, 0),
    2025: rows.reduce((sum, school) => sum + school.orders_2025, 0),
    2024: rows.reduce((sum, school) => sum + school.orders_2024, 0),
  },
}, null, 2));
