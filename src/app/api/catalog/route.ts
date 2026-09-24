import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { toPublicProduct } from "@/lib/server/mappers";
import { getSettings } from "@/lib/server/settings";

export const dynamic = "force-dynamic";

// Customer catalog: prices, descriptions, photos and stock-pricing stages — no private notes.
// When the store switch is OFF, no products are sent at all.
export const GET = handle(async () => {
  const settings = await getSettings();
  const products = settings.orderingEnabled ? await prisma.product.findMany({ orderBy: { code: "asc" } }) : [];
  return Response.json({ products: products.map(toPublicProduct), orderingEnabled: settings.orderingEnabled });
});
