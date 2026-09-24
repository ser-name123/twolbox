import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/client/client";

// One client per server instance; reused across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({
    // Serverless: keep the per-instance pool small — Supabase's pooler does the real pooling.
    adapter: new PrismaPg({ connectionString, max: 5 }),
    // Finalizes that touch the same product queue on its row lock, so allow waiting in line
    // instead of Prisma's 2s/5s defaults (which fail under a rush of customers or a distant DB).
    transactionOptions: { maxWait: 15000, timeout: 20000 },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
