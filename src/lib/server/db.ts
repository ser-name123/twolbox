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
    // Fail a stuck connect after 10s (instead of hanging ~40s) so the route can retry, and keep idle
    // connections for a minute — opening a new one to the pooler is the slow, flaky step.
    adapter: new PrismaPg({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 60000 }),
    // Finalizes that touch the same product queue on its row lock, so allow waiting in line
    // instead of Prisma's 2s/5s defaults (which fail under a rush of customers or a distant DB).
    transactionOptions: { maxWait: 15000, timeout: 20000 },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
