import "server-only";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Couldn't reach the database at all (pooler connect/auth timeout, reset) — nothing ran, safe to retry.
function isConnectionError(e: unknown): boolean {
  const s = String((e as { message?: string })?.message ?? e) + String((e as { code?: string })?.code ?? "");
  return /EAUTHTIMEOUT|ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|timeout exceeded when trying to connect|08006|08001|P1001|P1017/.test(s);
}

// Wraps a route handler: HttpError → JSON error with its status; anything else → 500 (logged).
// Read requests (GET) are retried once if the database connection itself failed.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    const req = args[0] instanceof Request ? args[0] : null;
    const canRetry = !req || req.method === "GET"; // never re-run writes
    try {
      try {
        return await fn(...args);
      } catch (e) {
        if (!canRetry || !isConnectionError(e)) throw e;
        console.warn("DB connection failed, retrying once:", (e as Error).message);
        return await fn(...args);
      }
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      console.error(e);
      return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }
  };
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid request body");
  }
}

export function parseCode(raw: string | number): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw).trim(), 10);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, "Invalid product code");
  return n;
}
