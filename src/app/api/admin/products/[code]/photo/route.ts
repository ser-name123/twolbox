import { requireRole } from "@/lib/server/auth";
import { deletePhoto, MAX_UPLOAD_BYTES, savePhoto } from "@/lib/server/blob";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, parseCode } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct } from "@/lib/server/mappers";

type Ctx = { params: Promise<{ code: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File) || !file.size) throw new HttpError(400, "Please choose a photo.");
  if (file.size > MAX_UPLOAD_BYTES) throw new HttpError(400, "Photo is too large.");

  const existing = await prisma.product.findUnique({ where: { code } });
  if (!existing) throw new HttpError(404, "Product not found.");

  let url: string;
  try {
    url = await savePhoto(code, file);
  } catch (e) {
    throw new HttpError(400, e instanceof Error ? e.message : "Photo upload failed.");
  }
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { code }, data: { photoUrl: url } });
    await writeLogs(tx, "manager", [{ action: "photo", details: `Code ${code} (${p.name}): photo ${existing.photoUrl ? "changed" : "added"}` }]);
    return p;
  });
  await deletePhoto(existing.photoUrl);
  return Response.json({ product: toProduct(product) });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  await requireRole("manager");
  const code = parseCode((await ctx.params).code);
  const existing = await prisma.product.findUnique({ where: { code } });
  if (!existing) throw new HttpError(404, "Product not found.");
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.product.update({ where: { code }, data: { photoUrl: null } });
    await writeLogs(tx, "manager", [{ action: "photo", details: `Code ${code} (${p.name}): photo removed` }]);
    return p;
  });
  await deletePhoto(existing.photoUrl);
  return Response.json({ product: toProduct(product) });
});
