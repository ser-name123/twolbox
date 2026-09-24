// Serverless function (Vercel). Backend routes for products/quotes/etc. will live under src/app/api.
export function GET() {
  return Response.json({ ok: true, ts: Date.now() });
}
