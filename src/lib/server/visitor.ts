import "server-only";

// device: shown/stored, may include the phone model the browser reports.
// baseDevice: from the user agent only (no client-reported model) — used for rate limiting.
export type Visitor = { ip: string; location: string; device: string; baseDevice: string; userAgent: string };

const header = (req: Request, name: string) => {
  const v = req.headers.get(name);
  if (!v) return "";
  try {
    return decodeURIComponent(v); // Vercel URL-encodes city names
  } catch {
    return v;
  }
};

// "Chrome on Android (SM-A525F)", "Safari on iPhone", "Edge on Windows" — readable, no extra library.
export function deviceFrom(ua: string, model?: string): string {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "Mac"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : /curl|bot|spider|python|wget/i.test(ua)
                ? "Script/Bot"
                : "Browser";
  // Phone model: from the browser's client hint if sent, else from older Android user agents.
  const uaModel = ua.match(/Android [\d.]+; ([^;)]+)[;)]/)?.[1]?.trim();
  const m = (model || (uaModel && uaModel !== "K" ? uaModel : "")).replace(/[^\w\s.+-]/g, "").slice(0, 40);
  return `${browser} on ${os}${m ? ` (${m})` : ""}`;
}

// Who is making this request. On Vercel, IP and approximate location come from the platform's
// request headers (x-forwarded-for, x-vercel-ip-*). Locally there's no location.
export function visitorFrom(req: Request, model?: string): Visitor {
  const ip = header(req, "x-forwarded-for").split(",")[0].trim() || header(req, "x-real-ip") || "unknown";
  const location = [header(req, "x-vercel-ip-city"), header(req, "x-vercel-ip-country-region"), header(req, "x-vercel-ip-country")]
    .filter(Boolean)
    .join(", ");
  const userAgent = header(req, "user-agent").slice(0, 200);
  const baseDevice = deviceFrom(userAgent).replace(/ \(.*\)$/, "");
  return { ip, location: location || "unknown location", device: deviceFrom(userAgent, model), baseDevice, userAgent };
}
