import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";

// Store ON/OFF switch for customer product search.
export const PATCH = handle(async (req: Request) => {
  await requireRole("manager");
  const { orderingEnabled } = await readJson<{ orderingEnabled?: boolean }>(req);
  if (typeof orderingEnabled !== "boolean") throw new HttpError(400, "Invalid setting");
  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "orderingEnabled" },
      create: { key: "orderingEnabled", value: orderingEnabled },
      update: { value: orderingEnabled },
    });
    await writeLogs(tx, "manager", [{ action: "settings", details: `Customer product search turned ${orderingEnabled ? "ON" : "OFF"}` }]);
  });
  return Response.json({ settings: { orderingEnabled } });
});
