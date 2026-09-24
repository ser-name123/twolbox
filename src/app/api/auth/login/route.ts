import { roleForPassword, setSession } from "@/lib/server/auth";
import { handle, HttpError, readJson } from "@/lib/server/http";

// One login for both roles — which password matches decides staff vs manager.
// `requireManager` is sent by the "Manager Access" prompt so a staff password is rejected there.
export const POST = handle(async (req: Request) => {
  const { password, requireManager } = await readJson<{ password?: string; requireManager?: boolean }>(req);
  // Small fixed delay slows down password guessing.
  await new Promise((r) => setTimeout(r, 400));
  const role = roleForPassword(String(password ?? ""));
  if (!role || (requireManager && role !== "manager")) throw new HttpError(401, "Incorrect password.");
  await setSession(role);
  return Response.json({ role });
});
