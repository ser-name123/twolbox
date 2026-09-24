import "server-only";

export function serialStart(): number {
  const n = parseInt(process.env.SERIAL_START || "1001", 10);
  return Number.isInteger(n) && n > 0 ? n : 1001;
}

// Next `count` free serial numbers. Gaps left by deleted products are filled first (lowest first),
// then numbering continues after the highest code in use.
export function nextFreeCodes(used: number[], count: number, start = serialStart()): number[] {
  const set = new Set(used);
  const out: number[] = [];
  for (let c = start; out.length < count; c++) if (!set.has(c)) out.push(c);
  return out;
}

// Codes between the start and the highest code in use that are currently free.
export function idleCodes(used: number[], start = serialStart()): number[] {
  const inRange = used.filter((c) => c >= start);
  if (!inRange.length) return [];
  const set = new Set(inRange);
  const max = Math.max(...inRange);
  const idle: number[] = [];
  for (let c = start; c < max; c++) if (!set.has(c)) idle.push(c);
  return idle;
}
