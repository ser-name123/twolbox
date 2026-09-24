import { roleForPassword, setSession } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { handle, readJson } from "@/lib/server/http";
import { visitorFrom } from "@/lib/server/visitor";

// One login for both roles — which password matches decides staff vs manager.
// `requireManager` is sent by the "Manager Access" prompt so a staff password is rejected there.
export const POST = handle(async (req: Request) => {
  const { password, requireManager } = await readJson<{ password?: string; requireManager?: boolean }>(req);
  // Small fixed delay slows down password guessing.
  await new Promise((r) => setTimeout(r, 400));
  const role = roleForPassword(String(password ?? ""));

  if (!role || (requireManager && role !== "manager")) {
    // Every failed attempt is recorded (Change History → Security), and the person is told so.
    const v = visitorFrom(req);
    await prisma.changeLog.create({
      data: {
        action: "security",
        actor: "unknown",
        details: `Failed ${requireManager ? "manager" : "staff"} login — IP ${v.ip}, ${v.location} · ${v.userAgent || "unknown browser"}`,
      },
    });
    return Response.json(
      {
        error: "Incorrect password.",
        warning: `Unauthorized access attempts are recorded. Your IP address (${v.ip}) and location have been logged and will be traced.`,
      },
      { status: 401 }
    );
  }

  await setSession(role);
  return Response.json({ role });
});
