import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";

type Ctx = { params: Promise<{ id: string }> };
type Changed = { code: number; name: string; old: string; new: string };

// Bulk % price change for every product in a group — permanent, like editing each price by hand.
// New prices round to the nearest ₹0.50 (the shop's pricing convention). Old-stock "next price" and
// quantity-discount slab prices are separate settings and are not touched.
export const POST = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const { id } = await ctx.params;
  const body = await readJson<{ percent?: number; direction?: string }>(req);
  const percent = Number(body.percent);
  const up = body.direction === "increase";
  if (!up && body.direction !== "decrease") throw new HttpError(400, "Choose increase or decrease.");
  if (!Number.isFinite(percent) || percent <= 0 || percent > (up ? 500 : 99)) {
    throw new HttpError(400, up ? "Enter a percentage between 0 and 500." : "Enter a percentage between 0 and 99.");
  }
  const factor = String(up ? 1 + percent / 100 : 1 - percent / 100);

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({ where: { id } });
    if (!group) throw new HttpError(404, "Group not found.");
    // One statement for the whole group (fast even with hundreds of products), returning old → new.
    const changed = await tx.$queryRaw<Changed[]>`
      UPDATE "Product" p
      SET price = ROUND(p.price * ${factor}::numeric * 2) / 2, "updatedAt" = now()
      FROM (SELECT code, price FROM "Product" WHERE "groupId" = ${id} FOR UPDATE) o
      WHERE p.code = o.code
      RETURNING p.code, p.name, o.price::text AS old, p.price::text AS new`;
    if (!changed.length) throw new HttpError(400, "This group has no products.");
    const lines = changed
      .sort((a, b) => a.code - b.code)
      .map((c) => `${c.code} ${c.name}: ₹${Number(c.old).toFixed(2)} → ₹${Number(c.new).toFixed(2)}`);
    await writeLogs(tx, "manager", [
      {
        action: "price_change",
        details: `Group "${group.name}": all prices ${up ? "increased" : "decreased"} by ${percent}% (${changed.length} products, rounded to ₹0.50) — ${lines.join("; ")}`,
      },
    ]);
    return { updated: changed.length };
  });
  return Response.json(result);
});
