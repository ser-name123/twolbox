import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";

// One-click: all products → Ask at Counter (or all back to fixed price).
export const POST = handle(async (req: Request) => {
  await requireRole("manager");
  const { value } = await readJson<{ value?: boolean }>(req);
  const on = value === true;
  const count = await prisma.$transaction(async (tx) => {
    const { count } = await tx.product.updateMany({ data: { askAtCounter: on } });
    await writeLogs(tx, "manager", [
      { action: "bulk", details: on ? `All products (${count}) marked as Ask at Counter` : `All products (${count}) set back to fixed price` },
    ]);
    return count;
  });
  return Response.json({ updated: count });
});
