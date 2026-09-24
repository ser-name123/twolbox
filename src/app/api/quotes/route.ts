import { Prisma, type Product as DbProduct } from "@/generated/client/client";
import { computeBreakdown, consumeAndAdvance } from "@/lib/pricing";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct, toQuote } from "@/lib/server/mappers";
import { getSettings } from "@/lib/server/settings";
import { dateKeyInTz, localMidnight } from "@/lib/server/time";
import type { QuoteItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LINES = 200;
const MAX_QTY = 100000;

// Staff: incoming quotes (today and yesterday, newest first), excluding cleared ones.
export const GET = handle(async () => {
  await requireRole("staff");
  const quotes = await prisma.quote.findMany({
    where: { archived: false, createdAt: { gte: localMidnight(1) } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return Response.json({ quotes: quotes.map(toQuote) });
});

// Customer: finalize a quote. Prices are always computed here from the latest product data —
// the browser only sends codes and quantities.
export const POST = handle(async (req: Request) => {
  const body = await readJson<{ customerName?: string; items?: { code: string | number; qty: number }[] }>(req);
  const customerName = String(body.customerName ?? "").trim().slice(0, 80);

  // Merge duplicate codes and drop zero lines.
  const qtyByCode = new Map<number, number>();
  for (const line of body.items ?? []) {
    const code = parseInt(String(line.code), 10);
    const qty = Math.floor(Number(line.qty));
    if (!Number.isInteger(code) || !Number.isFinite(qty) || qty <= 0) continue;
    qtyByCode.set(code, Math.min(MAX_QTY, (qtyByCode.get(code) ?? 0) + qty));
  }
  if (!qtyByCode.size) throw new HttpError(400, "Your list is empty.");
  if (qtyByCode.size > MAX_LINES) throw new HttpError(400, "Too many products in one quote.");

  // Checked before the transaction: keeps the locked section short.
  if (!(await getSettings()).orderingEnabled) {
    throw new HttpError(409, "Product search is temporarily paused. Please check with our staff.");
  }

  const quote = await prisma.$transaction(async (tx) => {
    const codes = [...qtyByCode.keys()];
    // Read + lock in one round-trip, so two customers finalizing at once can't both use the last
    // old-price units. ORDER BY gives every transaction the same lock order (no deadlocks).
    const rows = await tx.$queryRaw<DbProduct[]>`
      SELECT * FROM "Product" WHERE code IN (${Prisma.join(codes)}) ORDER BY code FOR UPDATE`;
    const byCode = new Map(rows.map((r) => [r.code, r]));

    const items: QuoteItem[] = [];
    const logs: string[] = [];
    for (const [code, qty] of qtyByCode) {
      const row = byCode.get(code);
      if (!row) continue; // deleted since the customer added it
      const p = toProduct(row);
      const bd = computeBreakdown(p, qty);
      items.push({ code: p.code, name: p.name, qty, parts: bd.parts, lineTotal: bd.lineTotal, hasCounterPortion: bd.hasCounterPortion, askAtCounter: p.askAtCounter });

      const r = consumeAndAdvance(p, qty);
      if (r.logs.length) {
        await tx.product.update({
          where: { code },
          data: {
            price: r.product.price,
            askAtCounter: r.product.askAtCounter,
            priceTransition: r.product.priceTransition ?? Prisma.DbNull,
          },
        });
        logs.push(...r.logs);
      }
    }
    if (!items.length) throw new HttpError(400, "These products are no longer available.");

    // Atomic per-day counter: quote numbers restart at 1 each day and never collide.
    const dateKey = dateKeyInTz();
    const [{ last }] = await tx.$queryRaw<{ last: number }[]>`
      INSERT INTO "DailyCounter" ("dateKey", "last") VALUES (${dateKey}, 1)
      ON CONFLICT ("dateKey") DO UPDATE SET "last" = "DailyCounter"."last" + 1
      RETURNING "last"`;

    await writeLogs(tx, "customer", logs.map((details) => ({ action: "price_change" as const, details })));

    const total = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
    return tx.quote.create({
      data: {
        number: last,
        dateKey,
        customerName,
        items: items as unknown as Prisma.InputJsonValue,
        total,
        hasCounterItems: items.some((i) => i.askAtCounter || i.hasCounterPortion),
      },
    });
  });

  return Response.json({ quote: toQuote(quote) });
});
