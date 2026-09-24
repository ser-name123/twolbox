import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import type { LogEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["add", "delete", "edit", "price_change", "bulk", "group", "settings", "photo", "security"]);

// Change history, newest first. ?action=price_change narrows it (e.g. pricing history only).
export const GET = handle(async (req: Request) => {
  await requireRole("manager");
  const action = new URL(req.url).searchParams.get("action");
  const rows = await prisma.changeLog.findMany({
    where: action && ACTIONS.has(action) ? { action } : undefined,
    orderBy: { ts: "desc" },
    take: 500,
  });
  const logs: LogEntry[] = rows.map((r) => ({ id: r.id, ts: r.ts.getTime(), action: r.action, details: r.details, actor: r.actor }));
  return Response.json({ logs });
});
