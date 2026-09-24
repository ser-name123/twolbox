import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError } from "@/lib/server/http";

// Removes a quote from the staff list. Kept in the database so analytics stay accurate.
export const DELETE = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole("staff");
  const { id } = await ctx.params;
  const { count } = await prisma.quote.updateMany({ where: { id }, data: { archived: true } });
  if (!count) throw new HttpError(404, "Quote not found.");
  return Response.json({ ok: true });
});
