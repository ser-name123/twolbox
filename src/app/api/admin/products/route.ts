import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct } from "@/lib/server/mappers";
import { nextFreeCodes } from "@/lib/server/serial";

// Add a single blank product; it gets the next free serial number.
export const POST = handle(async (req: Request) => {
  await requireRole("manager");
  const { groupId } = await readJson<{ groupId?: string | null }>(req);
  const product = await prisma.$transaction(async (tx) => {
    const group = groupId ? await tx.group.findUnique({ where: { id: groupId } }) : await tx.group.findFirst({ orderBy: { createdAt: "asc" } });
    const used = (await tx.product.findMany({ select: { code: true } })).map((p) => p.code);
    const [code] = nextFreeCodes(used, 1);
    const p = await tx.product.create({ data: { code, name: "New Product", price: 0, hsn: group?.hsn ?? "", groupId: group?.id ?? null } });
    await writeLogs(tx, "manager", [{ action: "add", details: `Code ${code} added${group ? ` in group "${group.name}"` : ""}` }]);
    return p;
  });
  return Response.json({ product: toProduct(product) });
});
