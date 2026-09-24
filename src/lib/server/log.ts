import "server-only";
import type { Prisma } from "@/generated/client/client";

type Tx = Prisma.TransactionClient;

export type LogAction = "add" | "delete" | "edit" | "price_change" | "bulk" | "group" | "settings" | "photo";

export async function writeLogs(tx: Tx, actor: string, entries: { action: LogAction; details: string }[]) {
  if (!entries.length) return;
  await tx.changeLog.createMany({ data: entries.map((e) => ({ ...e, actor })) });
}
