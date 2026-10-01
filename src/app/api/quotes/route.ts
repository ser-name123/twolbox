import { Prisma, type Product as DbProduct } from "@/generated/client/client";
import { computeBreakdown, consumeAndAdvance } from "@/lib/pricing";
import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { toProduct, toQuote } from "@/lib/server/mappers";
import { getSettings } from "@/lib/server/settings";
import { dateKeyInTz, localMidnight } from "@/lib/server/time";
import { visitorFrom, type Visitor } from "@/lib/server/visitor";
import { groupDiscountMap } from "@/lib/server/discounts";
import type { GroupSlab, QuoteItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_LINES = 200;
const MAX_QTY = 100000;
const SPAM_MAX_QUOTES = 5; // per device…
const SPAM_WINDOW_MS = 15 * 60 * 1000; // …in 15 minutes
const SPAM_MAX_PER_IP = 30; // whole network (shop Wi-Fi) in the same window

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
  const body = await readJson<{ customerName?: string; deviceModel?: string; items?: { code: string | number; qty: number }[] }>(req);
  const customerName = String(body.customerName ?? "").trim().slice(0, 80);
  const visitor = visitorFrom(req, body.deviceModel);

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

  // Read before the transaction (rarely changes) so the locked section stays short.
  const groupDiscounts = await groupDiscountMap();

  let quote;
  try {
    quote = await finalizeQuote(visitor, customerName, qtyByCode, groupDiscounts);
  } catch (e) {
    if (!(e instanceof TooManyQuotes)) throw e;
    await prisma.changeLog.create({
      data: { action: "security", actor: "unknown", details: `Quote blocked (too many quotes) — ${visitor.device}, IP ${visitor.ip}, ${visitor.location}` },
    });
    throw new HttpError(429, "Too many quotes from this device. Please ask our staff at the counter for help.");
  }
  return Response.json({ quote: toQuote(quote) });
});

class TooManyQuotes extends Error {}

async function finalizeQuote(visitor: Visitor, customerName: string, qtyByCode: Map<number, number>, groupDiscounts: Record<string, GroupSlab[]>) {
  return prisma.$transaction(async (tx) => {
    // Anti-spam: limit quotes per device (IP + device, so customers sharing the shop Wi-Fi aren't blocked together),
    // plus a higher cap per IP. The device is matched on the server-derived part only ("Chrome on Android"), not the
    // phone model the browser reports — otherwise sending a different model each time would dodge the limit.
    // The per-IP advisory lock makes simultaneous requests from one IP count one after another, so a burst
    // can't all slip under the limit together.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"quote-ip:" + visitor.ip}))`;
    const since = new Date(Date.now() - SPAM_WINDOW_MS);
    const perDevice = await tx.quote.count({ where: { ip: visitor.ip, device: { startsWith: visitor.baseDevice }, createdAt: { gte: since } } });
    const perIp = perDevice >= SPAM_MAX_QUOTES ? 0 : await tx.quote.count({ where: { ip: visitor.ip, createdAt: { gte: since } } });
    if (perDevice >= SPAM_MAX_QUOTES || perIp >= SPAM_MAX_PER_IP) throw new TooManyQuotes();

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
      const bd = computeBreakdown(p, qty, p.groupId ? groupDiscounts[p.groupId] : null);
      items.push({
        code: p.code, name: p.name, qty, parts: bd.parts, lineTotal: bd.lineTotal,
        hasCounterPortion: bd.hasCounterPortion, askAtCounter: p.askAtCounter, discount: bd.discount,
      });

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
        ip: visitor.ip,
        location: visitor.location,
        device: visitor.device,
      },
    });
  });
}
