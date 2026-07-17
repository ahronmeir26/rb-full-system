export type SchoolStatus = "Ready to order" | "In progress" | "Needs attention" | "Not started";
export type SchoolType = "regular" | "chassidish";
export type OutreachStatus = {
  name: string;
  isSystem: boolean;
};

export type School = {
  id: number;
  name: string;
  schoolType: SchoolType;
  outreachStatus: string;
  lastContactedAt: string;
  district: string;
  city: string;
  state: string;
  code: string;
  code2025: string;
  code2024: string;
  admin: string;
  email: string;
  phone: string;
  students: number;
  orders2026: number;
  orders2025: number;
  orders2024: number;
  status: SchoolStatus;
  progress: number;
  eligibility: string;
  lastContact: string;
  initials: string;
  color: string;
};
