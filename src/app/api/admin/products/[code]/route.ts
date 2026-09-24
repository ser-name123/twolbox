import { diffProduct } from "@/lib/pricing";
import { requireRole } from "@/lib/server/auth";
import { deletePhoto } from "@/lib/server/blob";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, parseCode, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toGroup, toProduct } from "@/lib/server/mappers";
import { productPatch } from "@/lib/server/products";

type Ctx = { params: Promise<{ code: string }> };

// Edit any product field(s). Every change is written to the change history.
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const data = productPatch(await readJson<Record<string, unknown>>(req));
  const product = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { code } });
    if (!before) throw new HttpError(404, "Product not found.");
    if (typeof data.groupId === "string" && !(await tx.group.findUnique({ where: { id: data.groupId } }))) {
      throw new HttpError(400, "That group no longer exists.");
    }
    const after = await tx.product.update({ where: { code }, data });
    const groups = (await tx.group.findMany()).map(toGroup);
    const line = diffProduct(groups, toProduct(before), toProduct(after));
    if (line) {
      const priceChanged = Number(before.price) !== Number(after.price) || before.askAtCounter !== after.askAtCounter;
      await writeLogs(tx, "manager", [{ action: priceChanged ? "price_change" : "edit", details: line }]);
    }
    return after;
  });
  return Response.json({ product: toProduct(product) });
});

// Delete a product. Its serial number becomes free for the next new product.
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const removed = await prisma.$transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { code } });
    if (!p) throw new HttpError(404, "Product not found.");
    await tx.product.delete({ where: { code } });
    await writeLogs(tx, "manager", [{ action: "delete", details: `Code ${code} (${p.name}) deleted — code is now free to reuse` }]);
    return p;
  });
  await deletePhoto(removed.photoUrl);
  return Response.json({ ok: true });
});
