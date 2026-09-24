import { getRole } from "@/lib/server/auth";
import { handle } from "@/lib/server/http";

export const GET = handle(async () => Response.json({ role: await getRole() }));
