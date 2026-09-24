import { prisma } from "@/lib/server/db";
import { handle, HttpError, readJson } from "@/lib/server/http";

const TYPES = new Set(["visit", "add", "remove"]);

// Customer activity for analytics. Public, fire-and-forget from the browser.
export const POST = handle(async (req: Request) => {
  const { type, code } = await readJson<{ type?: string; code?: string | number | null }>(req);
  if (!type || !TYPES.has(type)) throw new HttpError(400, "Invalid event");
  const n = code == null ? null : parseInt(String(code), 10);
  await prisma.event.create({ data: { type, code: n != null && Number.isInteger(n) ? n : null } });
  return Response.json({ ok: true });
});
