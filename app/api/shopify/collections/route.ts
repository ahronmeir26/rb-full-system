import { getViewer } from "@/lib/auth";
import { listShopifyCollections, shopifyConnectionStatus } from "@/lib/shopify";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Authentication required." }, { status: 401 });
  const connection = shopifyConnectionStatus();
  if (!connection.connected) return Response.json({ collections: [], connection });

  const search = new URL(request.url).searchParams.get("search") || "";
  try {
    const collections = await listShopifyCollections(search);
    return Response.json({ collections, connection });
  } catch (error) {
    console.error("Unable to load Shopify collections", error);
    return Response.json({
      collections: [],
      connection,
      error: error instanceof Error ? error.message : "Unable to load Shopify collections.",
    }, { status: 502 });
  }
}
