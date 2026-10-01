import { Prisma } from "@/generated/client/client";
import { slabLabel } from "@/lib/pricing";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { parseProductSlabs } from "@/lib/server/discounts";
import { handle, HttpError, parseCode, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct } from "@/lib/server/mappers";

type Ctx = { params: Promise<{ code: string }> };

// Set (or clear, with an empty list) a product's quantity discount slabs.
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const body = await readJson<{ slabs?: unknown; ignoreGroupDiscount?: boolean }>(req);
  const slabs = parseProductSlabs(body.slabs);
  const ignoreGroupDiscount = body.ignoreGroupDiscount === true;

  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { code } });
    if (!p) throw new HttpError(404, "Product not found.");
    const updated = await tx.product.update({
      where: { code },
      data: { qtyDiscount: slabs ?? Prisma.DbNull, ignoreGroupDiscount },
    });
    const rules = slabs ? slabs.map(slabLabel).join(", ") : "removed";
    await writeLogs(tx, "manager", [
      { action: "price_change", details: `Code ${code} (${p.name}): quantity discount ${rules}${ignoreGroupDiscount ? " · group discount not applied" : ""}` },
    ]);
    return updated;
  });
  return Response.json({ product: toProduct(product) });
});
