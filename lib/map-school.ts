import type { School, SchoolStatus, SchoolType } from "./types";

type SchoolRow = Partial<School> & Record<string, unknown>;

const statuses = new Set<SchoolStatus>(["Ready to order", "In progress", "Needs attention", "Not started", "Complete"]);
const schoolTypes = new Set<SchoolType>(["regular", "chassidish"]);
const avatarColors = ["mint", "blue", "peach", "violet", "gold", "rose"];

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function schoolInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function mapSchool(row: SchoolRow, index = 0): School {
  const id = asNumber(row.id, index + 1);
  const name = String(row.name ?? "");
  const rawStatus = String(row.status ?? "Not started") as SchoolStatus;
  const rawSchoolType = String(row.schoolType ?? row.school_type ?? "regular") as SchoolType;
  return {
    id,
    name,
    schoolType: schoolTypes.has(rawSchoolType) ? rawSchoolType : "regular",
    outreachStatus: String(row.outreachStatus ?? row.outreach_status ?? "Not contacted"),
    lastContactedAt: String(row.lastContactedAt ?? row.last_contacted_at ?? ""),
    lastMessageDirection: row.lastMessageDirection === "inbound" || row.last_message_direction === "inbound"
      ? "inbound"
      : row.lastMessageDirection === "outbound" || row.last_message_direction === "outbound"
        ? "outbound"
        : "",
    district: String(row.district ?? ""),
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    code: String(row.code ?? row.code_2026 ?? ""),
    code2025: String(row.code2025 ?? row.code_2025 ?? ""),
    code2024: String(row.code2024 ?? row.code_2024 ?? ""),
    admin: String(row.admin ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    students: asNumber(row.students),
    orders2026: asNumber(row.orders2026 ?? row.orders_2026),
    orders2025: asNumber(row.orders2025 ?? row.orders_2025),
    orders2024: asNumber(row.orders2024 ?? row.orders_2024),
    status: statuses.has(rawStatus) ? rawStatus : "Not started",
    progress: asNumber(row.progress),
    eligibility: String(row.eligibility ?? ""),
    lastContact: String(row.lastContact ?? row.last_contact ?? ""),
    initials: String(row.initials ?? schoolInitials(name)),
    color: String(row.color ?? avatarColors[(Math.max(id, 1) - 1) % avatarColors.length]),
  };
}
