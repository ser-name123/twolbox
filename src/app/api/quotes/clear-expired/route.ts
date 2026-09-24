import { QUOTE_VALID_MS } from "@/lib/config";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";

// Hides expired quotes from the staff list (kept for analytics).
export const POST = handle(async () => {
  await requireRole("staff");
  const { count } = await prisma.quote.updateMany({
    where: { archived: false, createdAt: { lt: new Date(Date.now() - QUOTE_VALID_MS) } },
    data: { archived: true },
  });
  return Response.json({ cleared: count });
});
