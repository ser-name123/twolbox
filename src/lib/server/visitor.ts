import "server-only";

export type Visitor = { ip: string; location: string; userAgent: string };

const header = (req: Request, name: string) => {
  const v = req.headers.get(name);
  if (!v) return "";
  try {
    return decodeURIComponent(v); // Vercel URL-encodes city names
  } catch {
    return v;
  }
};

// Who is making this request. On Vercel, IP and approximate location come from the platform's
// request headers (x-forwarded-for, x-vercel-ip-*). Locally there's no location.
export function visitorFrom(req: Request): Visitor {
  const ip = header(req, "x-forwarded-for").split(",")[0].trim() || header(req, "x-real-ip") || "unknown";
  const location = [header(req, "x-vercel-ip-city"), header(req, "x-vercel-ip-country-region"), header(req, "x-vercel-ip-country")]
    .filter(Boolean)
    .join(", ");
  return { ip, location: location || "unknown location", userAgent: header(req, "user-agent").slice(0, 200) };
}
