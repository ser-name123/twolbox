import { Prisma } from "@/generated/client/client";
import { slabLabel } from "@/lib/pricing";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { parseGroupSlabs } from "@/lib/server/discounts";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toGroup } from "@/lib/server/mappers";

type Ctx = { params: Promise<{ id: string }> };

// Set (or clear) a group-wide quantity discount: buy N+ of any product in the group → X% off.
// Products with their own slabs, or that opted out, aren't affected.
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const { id } = await ctx.params;
  const slabs = parseGroupSlabs((await readJson<{ slabs?: unknown }>(req)).slabs);
  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.findUnique({ where: { id } });
    if (!g) throw new HttpError(404, "Group not found.");
    const updated = await tx.group.update({ where: { id }, data: { qtyDiscount: slabs ?? Prisma.DbNull } });
    await writeLogs(tx, "manager", [
      { action: "price_change", details: `Group "${g.name}": quantity discount ${slabs ? slabs.map(slabLabel).join(", ") : "removed"}` },
    ]);
    return updated;
  });
  return Response.json({ group: toGroup(group) });
});
