export const DEFAULT_ORDER_LINK_TEMPLATE = "https://aistone.com/rb?discount={discountCode}";

export function orderLinkForSchool(template: string, schoolCode: string) {
  if (!schoolCode.trim()) return "https://aistone.com/rb";
  return template.replaceAll("{discountCode}", encodeURIComponent(schoolCode.trim()));
}
