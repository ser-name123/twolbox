import { clearSession } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const POST = handle(async () => {
  await clearSession();
  return Response.json({ ok: true });
});
