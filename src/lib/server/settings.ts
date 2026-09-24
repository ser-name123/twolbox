import "server-only";
import type { Prisma } from "@/generated/client/client";
import type { Settings } from "@/lib/types";
import { prisma } from "./db";

type Client = Prisma.TransactionClient | typeof prisma;

export async function getSettings(db: Client = prisma): Promise<Settings> {
  const row = await db.setting.findUnique({ where: { key: "orderingEnabled" } });
  return { orderingEnabled: row ? row.value !== false : true };
}
