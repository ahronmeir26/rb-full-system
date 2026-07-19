import { createClient } from "@supabase/supabase-js";
import type { DiscountProgram, DiscountSyncStatus, DiscountValueType } from "./types";
import { DEFAULT_ORDER_LINK_TEMPLATE } from "./order-link";

type DiscountProgramRow = Record<string, unknown>;

export const DEFAULT_DISCOUNT_PROGRAM: DiscountProgram = {
  id: "",
  programYear: 2026,
  title: "2026 Appreciation Program",
  mainCode: "",
  orderLinkTemplate: DEFAULT_ORDER_LINK_TEMPLATE,
  mensCollectionId: "",
  mensCollectionTitle: "Pre-order men's shirts",
  mensDiscountType: "percentage",
  mensDiscountValue: 0,
  boysCollectionId: "",
  boysCollectionTitle: "Pre-order boys' shirts",
  boysDiscountType: "percentage",
  boysDiscountValue: 0,
  startsAt: "",
  endsAt: "",
  usageLimit: null,
  appliesOncePerCustomer: false,
  combinesWithOrderDiscounts: false,
  combinesWithProductDiscounts: false,
  combinesWithShippingDiscounts: true,
  active: false,
  shopifyDiscountId: "",
  shopifyStatus: "",
  syncStatus: "draft",
  lastSyncedAt: "",
  lastSyncError: "",
};

function valueType(value: unknown): DiscountValueType {
  return value === "fixed_amount" ? "fixed_amount" : "percentage";
}

function syncStatus(value: unknown): DiscountSyncStatus {
  return value === "pending" || value === "synced" || value === "error" ? value : "draft";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function mapDiscountProgram(row?: DiscountProgramRow | null): DiscountProgram {
  if (!row) return { ...DEFAULT_DISCOUNT_PROGRAM };
  return {
    id: String(row.id ?? ""),
    programYear: numberValue(row.program_year, 2026),
    title: String(row.title ?? DEFAULT_DISCOUNT_PROGRAM.title),
    mainCode: String(row.main_code ?? ""),
    orderLinkTemplate: String(row.order_link_template ?? DEFAULT_ORDER_LINK_TEMPLATE),
    mensCollectionId: String(row.mens_collection_id ?? ""),
    mensCollectionTitle: String(row.mens_collection_title ?? DEFAULT_DISCOUNT_PROGRAM.mensCollectionTitle),
    mensDiscountType: valueType(row.mens_discount_type),
    mensDiscountValue: numberValue(row.mens_discount_value),
    boysCollectionId: String(row.boys_collection_id ?? ""),
    boysCollectionTitle: String(row.boys_collection_title ?? DEFAULT_DISCOUNT_PROGRAM.boysCollectionTitle),
    boysDiscountType: valueType(row.boys_discount_type),
    boysDiscountValue: numberValue(row.boys_discount_value),
    startsAt: String(row.starts_at ?? ""),
    endsAt: String(row.ends_at ?? ""),
    usageLimit: row.usage_limit == null ? null : numberValue(row.usage_limit),
    appliesOncePerCustomer: Boolean(row.applies_once_per_customer),
    combinesWithOrderDiscounts: Boolean(row.combines_with_order_discounts),
    combinesWithProductDiscounts: Boolean(row.combines_with_product_discounts),
    combinesWithShippingDiscounts: row.combines_with_shipping_discounts == null ? true : Boolean(row.combines_with_shipping_discounts),
    active: Boolean(row.active),
    shopifyDiscountId: String(row.shopify_discount_id ?? ""),
    shopifyStatus: String(row.shopify_status ?? ""),
    syncStatus: syncStatus(row.sync_status),
    lastSyncedAt: String(row.last_synced_at ?? ""),
    lastSyncError: String(row.last_sync_error ?? ""),
  };
}

export function discountProgramToRow(program: DiscountProgram) {
  return {
    program_year: 2026,
    title: program.title,
    main_code: program.mainCode || null,
    order_link_template: program.orderLinkTemplate,
    mens_collection_id: program.mensCollectionId || null,
    mens_collection_title: program.mensCollectionTitle || null,
    mens_discount_type: program.mensDiscountType,
    mens_discount_value: program.mensDiscountValue,
    boys_collection_id: program.boysCollectionId || null,
    boys_collection_title: program.boysCollectionTitle || null,
    boys_discount_type: program.boysDiscountType,
    boys_discount_value: program.boysDiscountValue,
    starts_at: program.startsAt || null,
    ends_at: program.endsAt || null,
    usage_limit: program.usageLimit,
    applies_once_per_customer: program.appliesOncePerCustomer,
    combines_with_order_discounts: program.combinesWithOrderDiscounts,
    combines_with_product_discounts: program.combinesWithProductDiscounts,
    combines_with_shipping_discounts: program.combinesWithShippingDiscounts,
    active: program.active,
  };
}

export function parseDiscountProgramInput(input: unknown, current: DiscountProgram): DiscountProgram {
  if (!input || typeof input !== "object") throw new Error("Discount settings are required.");
  const value = input as Record<string, unknown>;
  const text = (key: keyof DiscountProgram, fallback: string) =>
    typeof value[key] === "string" ? String(value[key]).trim() : fallback;
  const boolean = (key: keyof DiscountProgram, fallback: boolean) =>
    typeof value[key] === "boolean" ? Boolean(value[key]) : fallback;
  const discountValue = (key: "mensDiscountValue" | "boysDiscountValue", fallback: number) => {
    const parsed = Number(value[key] ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 0) throw new Error("Discount amounts must be zero or greater.");
    return Math.round(parsed * 100) / 100;
  };
  const discountType = (key: "mensDiscountType" | "boysDiscountType", fallback: DiscountValueType) => {
    const parsed = value[key];
    if (parsed !== "percentage" && parsed !== "fixed_amount") return fallback;
    return parsed;
  };
  const nullableInteger = (key: "usageLimit", fallback: number | null) => {
    if (!(key in value)) return fallback;
    if (value[key] === "" || value[key] == null) return null;
    const parsed = Number(value[key]);
    if (!Number.isInteger(parsed) || parsed < 1) throw new Error("The usage limit must be a whole number greater than zero.");
    return parsed;
  };

  const program: DiscountProgram = {
    ...current,
    title: text("title", current.title),
    mainCode: text("mainCode", current.mainCode).toUpperCase(),
    orderLinkTemplate: text("orderLinkTemplate", current.orderLinkTemplate),
    mensCollectionId: text("mensCollectionId", current.mensCollectionId),
    mensCollectionTitle: text("mensCollectionTitle", current.mensCollectionTitle),
    mensDiscountType: discountType("mensDiscountType", current.mensDiscountType),
    mensDiscountValue: discountValue("mensDiscountValue", current.mensDiscountValue),
    boysCollectionId: text("boysCollectionId", current.boysCollectionId),
    boysCollectionTitle: text("boysCollectionTitle", current.boysCollectionTitle),
    boysDiscountType: discountType("boysDiscountType", current.boysDiscountType),
    boysDiscountValue: discountValue("boysDiscountValue", current.boysDiscountValue),
    startsAt: text("startsAt", current.startsAt),
    endsAt: text("endsAt", current.endsAt),
    usageLimit: nullableInteger("usageLimit", current.usageLimit),
    appliesOncePerCustomer: boolean("appliesOncePerCustomer", current.appliesOncePerCustomer),
    combinesWithOrderDiscounts: boolean("combinesWithOrderDiscounts", current.combinesWithOrderDiscounts),
    combinesWithProductDiscounts: boolean("combinesWithProductDiscounts", current.combinesWithProductDiscounts),
    combinesWithShippingDiscounts: boolean("combinesWithShippingDiscounts", current.combinesWithShippingDiscounts),
    active: boolean("active", current.active),
  };

  if (!program.title || program.title.length > 120) throw new Error("Enter a program title of 120 characters or fewer.");
  if (program.mainCode.length > 64 || /[\s\u0000-\u001f\u007f]/.test(program.mainCode)) {
    throw new Error("The main code must be 64 characters or fewer and cannot contain spaces.");
  }
  if (!program.orderLinkTemplate || program.orderLinkTemplate.length > 2_000 || /[\u0000-\u001f\u007f]/.test(program.orderLinkTemplate)) {
    throw new Error("Enter an order-link template of up to 2,000 characters.");
  }
  if (!program.orderLinkTemplate.includes("{discountCode}")) {
    throw new Error("The order-link template must include {discountCode}.");
  }
  for (const collectionId of [program.mensCollectionId, program.boysCollectionId]) {
    if (collectionId && !/^gid:\/\/shopify\/Collection\/\d+$/.test(collectionId)) {
      throw new Error("Choose valid Shopify collections for the product groups.");
    }
  }
  if (program.mensDiscountType === "percentage" && program.mensDiscountValue > 100) {
    throw new Error("The men's percentage cannot exceed 100%.");
  }
  if (program.boysDiscountType === "percentage" && program.boysDiscountValue > 100) {
    throw new Error("The boys' percentage cannot exceed 100%.");
  }
  const starts = program.startsAt ? Date.parse(program.startsAt) : NaN;
  const ends = program.endsAt ? Date.parse(program.endsAt) : NaN;
  if (program.startsAt && !Number.isFinite(starts)) throw new Error("Enter a valid start date.");
  if (program.endsAt && !Number.isFinite(ends)) throw new Error("Enter a valid end date.");
  if (Number.isFinite(starts) && Number.isFinite(ends) && ends <= starts) {
    throw new Error("The end date must be after the start date.");
  }
  return program;
}

export async function loadDiscountProgram(): Promise<DiscountProgram> {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return { ...DEFAULT_DISCOUNT_PROGRAM };

  const supabase = createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from("discount_programs")
    .select("*")
    .eq("program_year", 2026)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_DISCOUNT_PROGRAM };
  return mapDiscountProgram(data);
}
