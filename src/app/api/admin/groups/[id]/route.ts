import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toGroup } from "@/lib/server/mappers";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const { id } = await ctx.params;
  const body = await readJson<{ name?: string; hsn?: string }>(req);
  const group = await prisma.$transaction(async (tx) => {
    const g = await tx.group.findUnique({ where: { id } });
    if (!g) throw new HttpError(404, "Group not found.");
    const name = body.name === undefined ? g.name : String(body.name).trim().slice(0, 100);
    const hsn = body.hsn === undefined ? g.hsn : String(body.hsn).trim().slice(0, 20);
    if (!name) throw new HttpError(400, "Group name cannot be empty.");
    if (name.toLowerCase() !== g.name.toLowerCase()) {
      const clash = await tx.group.findFirst({ where: { name: { equals: name, mode: "insensitive" }, NOT: { id } } });
      if (clash) throw new HttpError(409, "A group with this name already exists.");
    }
    const changes: string[] = [];
    if (name !== g.name) changes.push(`Name "${g.name}" → "${name}"`);
    if (hsn !== g.hsn) changes.push(`HSN "${g.hsn}" → "${hsn}"`);
    const updated = await tx.group.update({ where: { id }, data: { name, hsn } });
    if (changes.length) await writeLogs(tx, "manager", [{ action: "group", details: `Group "${g.name}": ${changes.join("; ")}` }]);
    return updated;
  });
  return Response.json({ group: toGroup(group) });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const { id } = await ctx.params;
  await prisma.$transaction(async (tx) => {
    const g = await tx.group.findUnique({ where: { id }, include: { _count: { select: { products: true } } } });
    if (!g) throw new HttpError(404, "Group not found.");
    if (g._count.products) throw new HttpError(409, "This group still has products. Move or delete them first.");
    await tx.group.delete({ where: { id } });
    await writeLogs(tx, "manager", [{ action: "group", details: `Group "${g.name}" deleted` }]);
  });
  return Response.json({ ok: true });
});
