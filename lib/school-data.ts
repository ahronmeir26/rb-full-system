import { createClient } from "@supabase/supabase-js";
import seedSchools from "@/app/school-data.generated.json";
import type { School, SchoolStatus, SchoolType } from "./types";

type SchoolRow = Partial<School> & Record<string, unknown>;

const statuses = new Set<SchoolStatus>(["Ready to order", "In progress", "Needs attention", "Not started"]);
const schoolTypes = new Set<SchoolType>(["regular", "chassidish"]);

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function mapSchool(row: SchoolRow, index: number): School {
  const fallback = seedSchools[index % seedSchools.length] as School;
  const rawStatus = String(row.status ?? fallback.status) as SchoolStatus;
  const rawSchoolType = String(row.schoolType ?? row.school_type ?? fallback.schoolType ?? "regular") as SchoolType;
  return {
    id: asNumber(row.id, index + 1),
    name: String(row.name ?? fallback.name),
    schoolType: schoolTypes.has(rawSchoolType) ? rawSchoolType : "regular",
    district: String(row.district ?? fallback.district),
    city: String(row.city ?? fallback.city),
    state: String(row.state ?? fallback.state),
    code: String(row.code ?? row.code_2026 ?? fallback.code),
    code2025: String(row.code2025 ?? row.code_2025 ?? fallback.code2025),
    code2024: String(row.code2024 ?? row.code_2024 ?? fallback.code2024),
    admin: String(row.admin ?? fallback.admin),
    email: String(row.email ?? fallback.email),
    phone: String(row.phone ?? fallback.phone),
    students: asNumber(row.students, fallback.students),
    orders2026: asNumber(row.orders2026 ?? row.orders_2026, fallback.orders2026),
    orders2025: asNumber(row.orders2025 ?? row.orders_2025, fallback.orders2025),
    orders2024: asNumber(row.orders2024 ?? row.orders_2024, fallback.orders2024),
    status: statuses.has(rawStatus) ? rawStatus : fallback.status as SchoolStatus,
    progress: asNumber(row.progress, fallback.progress),
    eligibility: String(row.eligibility ?? fallback.eligibility),
    lastContact: String(row.lastContact ?? row.last_contact ?? fallback.lastContact),
    initials: String(row.initials ?? fallback.initials),
    color: String(row.color ?? fallback.color),
  };
}

export async function loadSchools(schoolId?: number): Promise<{ schools: School[]; source: "supabase" | "workbook" }> {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const fallback = (seedSchools as unknown as SchoolRow[]).map(mapSchool);

  const fallbackSchools = schoolId ? fallback.filter((school) => school.id === schoolId) : fallback;
  if (!url || !secret) return { schools: fallbackSchools, source: "workbook" };

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let query = supabase.from("schools").select("*").order("name");
  if (schoolId) query = query.eq("id", schoolId);
  const { data, error } = await query;
  if (error || !data?.length) return { schools: fallbackSchools, source: "workbook" };

  return { schools: data.map(mapSchool), source: "supabase" };
}
