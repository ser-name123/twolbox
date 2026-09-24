import { requireRole } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle } from "@/lib/server/http";
import { toGroup, toProduct } from "@/lib/server/mappers";
import { idleCodes, nextFreeCodes } from "@/lib/server/serial";
import { getSettings } from "@/lib/server/settings";
import type { AdminData } from "@/lib/types";

export const dynamic = "force-dynamic";

// Everything the manager's Products screen needs, in one call.
export const GET = handle(async () => {
  await requireRole("manager");
  const [products, groups, settings] = await Promise.all([
    prisma.product.findMany({ orderBy: { code: "asc" } }),
    prisma.group.findMany({ orderBy: { createdAt: "asc" } }),
    getSettings(),
  ]);
  const used = products.map((p) => p.code);
  const data: AdminData = {
    products: products.map(toProduct),
    groups: groups.map(toGroup),
    settings,
    nextCode: String(nextFreeCodes(used, 1)[0]),
    idleCodes: idleCodes(used),
  };
  return Response.json(data);
});
