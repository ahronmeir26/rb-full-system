export type SchoolStatus = "Ready to order" | "In progress" | "Needs attention" | "Not started" | "Complete";
export type SchoolType = "regular" | "chassidish";
export type OutreachStatus = {
  name: string;
  isSystem: boolean;
};

export type DiscountValueType = "percentage" | "fixed_amount";
export type DiscountSyncStatus = "draft" | "pending" | "synced" | "error";

export type DiscountProgram = {
  id: string;
  programYear: number;
  title: string;
  mainCode: string;
  mensCollectionId: string;
  mensCollectionTitle: string;
  mensDiscountType: DiscountValueType;
  mensDiscountValue: number;
  boysCollectionId: string;
  boysCollectionTitle: string;
  boysDiscountType: DiscountValueType;
  boysDiscountValue: number;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  appliesOncePerCustomer: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithProductDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  active: boolean;
  shopifyDiscountId: string;
  shopifyStatus: string;
  syncStatus: DiscountSyncStatus;
  lastSyncedAt: string;
  lastSyncError: string;
};

export type School = {
  id: number;
  name: string;
  schoolType: SchoolType;
  outreachStatus: string;
  lastContactedAt: string;
  lastMessageDirection: "inbound" | "outbound" | "";
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
