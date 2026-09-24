import { Prisma } from "@/generated/client/client";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, parseCode, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct } from "@/lib/server/mappers";
import { parseTransition } from "@/lib/server/products";

type Ctx = { params: Promise<{ code: string }> };

// Set or cancel an old-stock price update (e.g. 8 left at the old price, then the new price).
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const body = await readJson<{ transition?: unknown }>(req);
  const t = body.transition == null ? null : parseTransition(body.transition);

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { code } });
    if (!p) throw new HttpError(404, "Product not found.");
    const updated = await tx.product.update({ where: { code }, data: { priceTransition: t ?? Prisma.DbNull } });
    const price = Number(p.price).toFixed(2);
    const details = t
      ? `Code ${code} (${p.name}): price update set — ${t.remainingQty} left at ₹${price}, then ${
          t.nextMode === "counter" ? "Ask at Counter" : `₹${t.newPrice!.toFixed(2)}${t.newPriceQty ? ` for ${t.newPriceQty} unit(s), then Ask at Counter` : ""}`
        }`
      : `Code ${code} (${p.name}): pending price update cancelled`;
    await writeLogs(tx, "manager", [{ action: "price_change", details }]);
    return updated;
  });
  return Response.json({ product: toProduct(product) });
});
