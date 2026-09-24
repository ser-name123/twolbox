import "server-only";

const DAY_MS = 86400000;

export function storeTz(): string {
  return process.env.STORE_TIMEZONE || "Asia/Kolkata";
}

// YYYY-MM-DD in the store's timezone (Vercel servers run in UTC).
export function dateKeyInTz(d = new Date(), tz = storeTz()): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

// Offset of the store timezone from UTC right now, in ms.
function tzOffsetMs(tz: string, at = new Date()): number {
  const local = new Date(at.toLocaleString("en-US", { timeZone: tz }));
  const utc = new Date(at.toLocaleString("en-US", { timeZone: "UTC" }));
  return local.getTime() - utc.getTime();
}

// UTC instant of local midnight `daysAgo` days back (0 = start of today in the store).
export function localMidnight(daysAgo = 0, tz = storeTz()): Date {
  const off = tzOffsetMs(tz);
  const now = Date.now();
  const localDayStart = Math.floor((now + off) / DAY_MS) * DAY_MS;
  return new Date(localDayStart - off - daysAgo * DAY_MS);
}
