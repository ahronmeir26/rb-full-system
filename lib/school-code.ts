import type { School } from "./types";

export function initial2026SchoolCode(school: Pick<School, "code" | "code2025">) {
  if (school.code.trim()) return school.code;

  const code2025 = school.code2025.trim();
  return code2025.endsWith("25") ? `${code2025.slice(0, -2)}26` : "";
}
