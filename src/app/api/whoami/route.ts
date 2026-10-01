import { handle } from "@/lib/server/http";
import { visitorFrom } from "@/lib/server/visitor";

export const dynamic = "force-dynamic";

// Shown to customers on the main page: the device, IP and location their quotes will be logged with.
export const GET = handle(async (req: Request) => {
  const model = new URL(req.url).searchParams.get("model") ?? undefined;
  const { ip, location, device } = visitorFrom(req, model);
  return Response.json({ ip, location, device });
});
