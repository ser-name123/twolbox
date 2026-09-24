import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toGroup } from "@/lib/server/mappers";

export const POST = handle(async (req: Request) => {
  await requireRole("manager");
  const body = await readJson<{ name?: string; hsn?: string }>(req);
  const name = String(body.name ?? "").trim().slice(0, 100);
  const hsn = String(body.hsn ?? "").trim().slice(0, 20);
  if (!name) throw new HttpError(400, "Group name is required.");
  const group = await prisma.$transaction(async (tx) => {
    const clash = await tx.group.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (clash) throw new HttpError(409, "A group with this name already exists.");
    const g = await tx.group.create({ data: { name, hsn } });
    await writeLogs(tx, "manager", [{ action: "group", details: `Group "${name}" added${hsn ? ` (HSN ${hsn})` : ""}` }]);
    return g;
  });
  return Response.json({ group: toGroup(group) });
});
