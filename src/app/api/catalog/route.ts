import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { toPublicProduct } from "@/lib/server/mappers";
import { getSettings } from "@/lib/server/settings";
import { groupDiscountMap } from "@/lib/server/discounts";

export const dynamic = "force-dynamic";

// Customer catalog: prices, descriptions, photos, stock-pricing stages and quantity discounts — no private notes.
// When the store switch is OFF, no products are sent at all.
export const GET = handle(async () => {
  const settings = await getSettings();
  if (!settings.orderingEnabled) return Response.json({ products: [], orderingEnabled: false, groupDiscounts: {} });
  const [products, groupDiscounts] = await Promise.all([prisma.product.findMany({ orderBy: { code: "asc" } }), groupDiscountMap()]);
  return Response.json({ products: products.map(toPublicProduct), orderingEnabled: true, groupDiscounts });
});
