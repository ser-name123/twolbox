import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { localMidnight, storeTz } from "@/lib/server/time";
import type { Analytics, ProductStat, QuoteItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number | null> = { today: 1, "7d": 7, "14d": 14, "30d": 30, all: null };

type Row = { k: number | string; n: number };

export const GET = handle(async (req: Request) => {
  await requireRole("manager");
  const rangeParam = new URL(req.url).searchParams.get("range") ?? "14d";
  const range = rangeParam in RANGE_DAYS ? rangeParam : "14d";
  const days = RANGE_DAYS[range];
  const since = days ? localMidnight(days - 1) : new Date(0);
  const since14 = localMidnight(13);
  const tz = storeTz();

  // Timestamps are stored in UTC; convert to store-local time before bucketing.
  const [eventTotals, quoteAgg, visitHours, quoteHours, visitDow, quoteDow, visitDays, quoteDays, productEvents, quotesInRange, products] =
    await Promise.all([
      prisma.event.groupBy({ by: ["type"], where: { ts: { gte: since } }, _count: { _all: true } }),
      prisma.quote.aggregate({ where: { createdAt: { gte: since } }, _count: { _all: true }, _sum: { total: true } }),
      prisma.$queryRaw<Row[]>`SELECT EXTRACT(HOUR FROM ("ts" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS k, COUNT(*)::int AS n
        FROM "Event" WHERE "type" = 'visit' AND "ts" >= ${since} GROUP BY 1`,
      prisma.$queryRaw<Row[]>`SELECT EXTRACT(HOUR FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS k, COUNT(*)::int AS n
        FROM "Quote" WHERE "createdAt" >= ${since} GROUP BY 1`,
      prisma.$queryRaw<Row[]>`SELECT EXTRACT(DOW FROM ("ts" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS k, COUNT(*)::int AS n
        FROM "Event" WHERE "type" = 'visit' AND "ts" >= ${since} GROUP BY 1`,
      prisma.$queryRaw<Row[]>`SELECT EXTRACT(DOW FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::int AS k, COUNT(*)::int AS n
        FROM "Quote" WHERE "createdAt" >= ${since} GROUP BY 1`,
      prisma.$queryRaw<Row[]>`SELECT to_char(("ts" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS k, COUNT(*)::int AS n
        FROM "Event" WHERE "type" = 'visit' AND "ts" >= ${since14} GROUP BY 1`,
      prisma.$queryRaw<Row[]>`SELECT "dateKey" AS k, COUNT(*)::int AS n FROM "Quote" WHERE "createdAt" >= ${since14} GROUP BY 1`,
      prisma.event.groupBy({ by: ["code", "type"], where: { ts: { gte: since }, type: { in: ["add", "remove"] }, code: { not: null } }, _count: { _all: true } }),
      prisma.quote.findMany({ where: { createdAt: { gte: since } }, select: { items: true } }),
      prisma.product.findMany({ select: { code: true, name: true }, orderBy: { code: "asc" } }),
    ]);

  const count = (type: string) => eventTotals.find((e) => e.type === type)?._count._all ?? 0;
  const toMap = (rows: Row[]) => new Map(rows.map((r) => [String(r.k), Number(r.n)]));

  const vh = toMap(visitHours), qh = toMap(quoteHours);
  const vd = toMap(visitDow), qd = toMap(quoteDow);
  const vday = toMap(visitDays), qday = toMap(quoteDays);

  const last14Days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(since14.getTime() + (i + 12 / 24) * 86400000).toLocaleDateString("en-CA", { timeZone: tz });
    return { date, visits: vday.get(date) ?? 0, quotes: qday.get(date) ?? 0 };
  });

  // Per-product activity: added to a list, removed again, units actually quoted.
  const names = new Map(products.map((p) => [String(p.code), p.name]));
  const stats = new Map<string, ProductStat>();
  const stat = (code: string, name?: string) => {
    let s = stats.get(code);
    if (!s) stats.set(code, (s = { code, name: names.get(code) ?? name ?? "(deleted)", added: 0, removed: 0, quotedQty: 0 }));
    return s;
  };
  products.forEach((p) => stat(String(p.code)));
  for (const e of productEvents) {
    const s = stat(String(e.code));
    if (e.type === "add") s.added += e._count._all;
    else s.removed += e._count._all;
  }
  for (const q of quotesInRange) for (const i of q.items as QuoteItem[]) stat(i.code, i.name).quotedQty += i.qty;

  const all = [...stats.values()];
  const current = all.filter((s) => names.has(s.code));

  const data: Analytics = {
    range,
    totals: {
      visits: count("visit"),
      adds: count("add"),
      removes: count("remove"),
      quotes: quoteAgg._count._all,
      quoteValue: Number(quoteAgg._sum.total ?? 0),
    },
    byHour: Array.from({ length: 24 }, (_, h) => ({ hour: h, visits: vh.get(String(h)) ?? 0, quotes: qh.get(String(h)) ?? 0 })),
    byWeekday: Array.from({ length: 7 }, (_, d) => ({ day: d, visits: vd.get(String(d)) ?? 0, quotes: qd.get(String(d)) ?? 0 })),
    last14Days,
    topAdded: all.filter((s) => s.added > 0).sort((a, b) => b.added - a.added || b.quotedQty - a.quotedQty).slice(0, 10),
    mostRemoved: all.filter((s) => s.removed > 0).sort((a, b) => b.removed - a.removed || b.removed / b.added - a.removed / a.added).slice(0, 10),
    rarelySelected: current.sort((a, b) => a.added - b.added || a.quotedQty - b.quotedQty || Number(a.code) - Number(b.code)).slice(0, 10),
  };
  return Response.json(data);
});
