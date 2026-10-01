import "server-only";
import type { Prisma } from "@/generated/client/client";
import type { GroupSlab, QtySlab } from "@/lib/types";
import { prisma } from "./db";
import { HttpError } from "./http";

type Client = Prisma.TransactionClient | typeof prisma;

const MAX_SLABS = 10;

// groupId → slabs, for groups that have a quantity discount.
export async function groupDiscountMap(db: Client = prisma): Promise<Record<string, GroupSlab[]>> {
  const groups = await db.group.findMany({ select: { id: true, qtyDiscount: true } }); // a shop has few groups
  const out: Record<string, GroupSlab[]> = {};
  for (const g of groups) if (Array.isArray(g.qtyDiscount) && g.qtyDiscount.length) out[g.id] = g.qtyDiscount as GroupSlab[];
  return out;
}

function parseMinQty(v: unknown, row: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 2) throw new HttpError(400, `Slab ${row}: quantity must be 2 or more.`);
  return n;
}

function finish<T extends { minQty: number }>(slabs: T[]): T[] | null {
  if (slabs.length > MAX_SLABS) throw new HttpError(400, `At most ${MAX_SLABS} slabs.`);
  const seen = new Set<number>();
  for (const s of slabs) {
    if (seen.has(s.minQty)) throw new HttpError(400, `Two slabs use the same quantity (${s.minQty}+).`);
    seen.add(s.minQty);
  }
  return slabs.length ? slabs.sort((a, b) => a.minQty - b.minQty) : null;
}

// Product slabs: buy minQty+ → exact price per unit.
export function parseProductSlabs(raw: unknown): QtySlab[] | null {
  const rows = Array.isArray(raw) ? raw : [];
  return finish(
    rows.map((r, i) => {
      const price = Number(String((r as Record<string, unknown>)?.price ?? "").replace(/[₹,\s]/g, ""));
      if (!Number.isFinite(price) || price < 0) throw new HttpError(400, `Slab ${i + 1}: enter a valid price.`);
      return { minQty: parseMinQty((r as Record<string, unknown>)?.minQty, i + 1), price: Math.round(price * 100) / 100 };
    })
  );
}

// Group slabs: buy minQty+ → percent off.
export function parseGroupSlabs(raw: unknown): GroupSlab[] | null {
  const rows = Array.isArray(raw) ? raw : [];
  return finish(
    rows.map((r, i) => {
      const percent = Number((r as Record<string, unknown>)?.percent);
      if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) throw new HttpError(400, `Slab ${i + 1}: discount must be between 0 and 100%.`);
      return { minQty: parseMinQty((r as Record<string, unknown>)?.minQty, i + 1), percent: Math.round(percent * 100) / 100 };
    })
  );
}
