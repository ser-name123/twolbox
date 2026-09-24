import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";
import { writeLogs } from "@/lib/server/log";
import { parsePrice } from "@/lib/server/products";
import { nextFreeCodes } from "@/lib/server/serial";

type Row = { name?: string; price?: string | number; hsn?: string; narration?: string; group?: string };

// Bulk import from the Excel-style grid. Serial numbers are assigned here; group names that
// don't exist yet are created automatically.
export const POST = handle(async (req: Request) => {
  await requireRole("manager");
  const { rows, defaultGroupId } = await readJson<{ rows?: Row[]; defaultGroupId?: string }>(req);
  const clean = (rows ?? [])
    .map((r, i) => ({ i, name: String(r.name ?? "").trim().slice(0, 200), r }))
    .filter((x) => x.name);
  if (!clean.length) throw new HttpError(400, "Nothing to import — type or paste at least one product name.");
  if (clean.length > 2000) throw new HttpError(400, "Please import at most 2000 rows at a time.");

  // Validate prices up front so one bad cell doesn't leave a half-finished import.
  const prices = clean.map(({ i, r }) => {
    try {
      return r.price === undefined || String(r.price).trim() === "" ? 0 : parsePrice(r.price);
    } catch {
      throw new HttpError(400, `Row ${i + 1}: invalid price "${r.price}"`);
    }
  });

  const codes = await prisma.$transaction(async (tx) => {
    const groups = await tx.group.findMany({ orderBy: { createdAt: "asc" } });
    const byName = new Map(groups.map((g) => [g.name.toLowerCase(), g]));
    const fallback = groups.find((g) => g.id === defaultGroupId) ?? groups[0] ?? null;
    const newGroups: string[] = [];

    const groupFor = async (name: string | undefined) => {
      const n = String(name ?? "").trim().slice(0, 100);
      if (!n) return fallback;
      const hit = byName.get(n.toLowerCase());
      if (hit) return hit;
      const g = await tx.group.create({ data: { name: n } });
      byName.set(n.toLowerCase(), g);
      newGroups.push(n);
      return g;
    };

    const used = (await tx.product.findMany({ select: { code: true } })).map((p) => p.code);
    const codes = nextFreeCodes(used, clean.length);
    const data = [];
    for (let k = 0; k < clean.length; k++) {
      const { name, r } = clean[k];
      const g = await groupFor(r.group);
      data.push({
        code: codes[k],
        name,
        price: prices[k],
        hsn: String(r.hsn ?? "").trim().slice(0, 20) || g?.hsn || "",
        narration: String(r.narration ?? "").trim().slice(0, 500),
        groupId: g?.id ?? null,
      });
    }
    await tx.product.createMany({ data });
    await writeLogs(tx, "manager", [
      ...newGroups.map((n) => ({ action: "group" as const, details: `Group "${n}" created during bulk import` })),
      { action: "bulk", details: `Bulk import: ${data.length} product(s) added (codes ${codes.join(", ")})` },
    ]);
    return codes;
  });

  return Response.json({ added: codes.length, codes });
});
