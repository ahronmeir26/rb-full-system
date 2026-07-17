import { getViewer } from "@/lib/auth";
import { listShopifyOrdersByDiscountCode, shopifyConnectionStatus } from "@/lib/shopify";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });

  const code = new URL(request.url).searchParams.get("discountCode")?.trim() || "";
  if (!code || code.length > 64) return Response.json({ error: "A valid discount code is required." }, { status: 400 });
  if (!shopifyConnectionStatus().connected) {
    return Response.json({ error: "Shopify is not connected." }, { status: 503 });
  }

  try {
    return Response.json({ orders: await listShopifyOrdersByDiscountCode(code) });
  } catch (error) {
    console.error("Unable to load Shopify orders", error);
    return Response.json({ error: "Unable to load Shopify orders." }, { status: 502 });
  }
}
