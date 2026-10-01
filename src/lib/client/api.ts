// Browser → serverless API. Every call throws ApiError with a message that's safe to show.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data: Record<string, unknown> = {}
  ) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "No internet connection. Please try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "Something went wrong. Please try again.", data);
  return data as T;
}

// Analytics events must never block or break the customer flow.
export function track(type: "visit" | "add" | "remove", code?: string) {
  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, code: code ?? null }),
    keepalive: true,
  }).catch(() => {});
}

// Phone model from the browser's client hints (Chrome/Edge on Android give e.g. "SM-A525F").
// Other browsers don't share it; the server falls back to the user agent.
export async function deviceModel(): Promise<string> {
  try {
    const uad = (navigator as Navigator & { userAgentData?: { getHighEntropyValues(h: string[]): Promise<{ model?: string }> } }).userAgentData;
    return (await uad?.getHighEntropyValues(["model"]))?.model ?? "";
  } catch {
    return "";
  }
}

// Shrinks a photo in the browser before upload (max 1200px, JPEG) — keeps uploads small and fast.
export async function resizeImage(file: File, maxSide = 1200, quality = 0.85): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file.");
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) throw new Error("This image could not be read. Please use JPG or PNG.");
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs → white, not black, in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
  if (!blob) throw new Error("Could not process the photo.");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}
