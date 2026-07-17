import { createClient } from "@supabase/supabase-js";
import seedSchools from "@/app/school-data.generated.json";
import { mapSchool } from "./map-school";
import type { OutreachStatus, School } from "./types";

type SchoolRow = Partial<School> & Record<string, unknown>;

const defaultOutreachStatuses: OutreachStatus[] = [
  { name: "Not contacted", isSystem: true },
  { name: "Sent invite", isSystem: true },
  { name: "Not interested", isSystem: true },
  { name: "Interested", isSystem: true },
  { name: "Sent", isSystem: true },
];

export async function loadOutreachStatuses(): Promise<OutreachStatus[]> {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return defaultOutreachStatuses;

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("school_outreach_statuses")
    .select("name,is_system")
    .order("sort_order")
    .order("name");
  if (error || !data?.length) return defaultOutreachStatuses;
  return data.map((status) => ({ name: status.name, isSystem: status.is_system }));
}

export async function loadSchools(schoolId?: number): Promise<{ schools: School[]; source: "supabase" | "workbook" }> {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const fallback = (seedSchools as unknown as SchoolRow[])
    .map((row, index) => mapSchool({ outreachStatus: "Sent invite", ...row }, index));

  const fallbackSchools = schoolId ? fallback.filter((school) => school.id === schoolId) : fallback;
  if (!url || !secret) return { schools: fallbackSchools, source: "workbook" };

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let query = supabase.from("schools_overview").select("*").order("name");
  if (schoolId) query = query.eq("id", schoolId);
  const { data, error } = await query;
  if (error || !data?.length) return { schools: fallbackSchools, source: "workbook" };

  return { schools: data.map(mapSchool), source: "supabase" };
}
