# Twolbox — Quote Maker

QR / website → product code search → cart → quote number → final pricing & goods at the counter.
Not an e-commerce store: no online payment, no orders — just fast, accurate quotes.

**Stack:** Next.js 16 (App Router, serverless API routes) · Supabase Postgres via Prisma 7 · Vercel Blob (product photos) · deployed on Vercel.

## Three parts

| Part | Who | What |
|---|---|---|
| Customer website (`/`) | Anyone (QR code) | Search by code, see GST-inclusive price, description & photo, adjust quantity, finalize → quote number (restarts at 1 daily, valid 1 hour) |
| Staff panel ("Staff Login") | `STAFF_PASSWORD` | Incoming quotes (auto-refresh), valid/expired, print, PDF, copy text / WhatsApp / email. Cannot see or change products or prices |
| Manager panel | `MANAGER_PASSWORD` | Everything staff can, plus products, prices, groups/HSN, photos, private notes, Ask-at-Counter (single + all), bulk paste import, old-stock price updates, store ON/OFF switch, analytics, change history |

### Old-stock pricing
On any product, **Price Update** sets e.g. "8 units left at the current price, then ₹4". A customer ordering 10 sees
`8 × ₹3 + 2 × ₹4`. When a quote is finalized, the server consumes the stock stage and automatically switches the
product to the new price (or to Ask at Counter) once the old stock runs out. Rows are locked during finalize, so two
customers can't both get the last old-price units. See `src/lib/pricing.ts`.

### Serial numbers
Products get codes automatically from `SERIAL_START` (1001, 1002, …). A deleted product's code is reused by the next new product.

## Local development

```bash
npm install
cp .env.example .env          # fill in values (see below)
npx prisma migrate dev        # create tables
npm run db:seed               # 3 sample groups, products 1001–1005
npm run dev                   # http://localhost:3000
```

No Supabase yet? `npx prisma dev --name twolbox --detach` starts a local Postgres; put the `postgres://…` URL it prints into
both `DATABASE_URL` and `DIRECT_URL`.

Without `BLOB_READ_WRITE_TOKEN`, local dev stores photos inside the database (fine for testing; production requires Blob).

> **This folder is on an exFAT drive (E:).** exFAT has no symlinks/junctions, so Turbopack and `next build` fail here —
> that's why `dev`/`build` use `--webpack`, and why production builds should run on Vercel (Linux) or an NTFS drive.
> Moving the project to C: avoids these issues entirely.

## Deploy (Vercel + Supabase)

1. **Supabase** → new project → *Project Settings → Database → Connection string*:
   - Transaction pooler (port **6543**) → `DATABASE_URL` (append `?uselibpqcompat=true&sslmode=require`)
   - Session pooler (port **5432**) → `DIRECT_URL` (append `?sslmode=require`). The `db.<ref>.supabase.co` direct host is IPv6-only.
2. Create tables once from your machine: `DIRECT_URL=… npx prisma migrate deploy`, then `npm run db:seed` (optional).
3. **Vercel** → import the Git repo. Environment variables:
   `DATABASE_URL`, `DIRECT_URL`, `STAFF_PASSWORD`, `MANAGER_PASSWORD`, `SESSION_SECRET` (32+ random chars),
   `STORE_TIMEZONE` (`Asia/Kolkata`), `SERIAL_START` (`1001`).
4. **Vercel → Storage → Blob → Create & connect** to the project (adds `BLOB_READ_WRITE_TOKEN` automatically).
   Functions run in `syd1` (see `vercel.json`) to sit next to the Supabase database (ap-southeast-2).
5. Deploy. Make the QR code point at the site URL.

After schema changes: `npx prisma migrate dev --name <change>` locally, then `npx prisma migrate deploy` against Supabase.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run lint` | TypeScript check |
| `npm run db:migrate` / `db:deploy` | Create / apply migrations |
| `npm run db:seed` | Sample data (skips if products exist) |
| `npm run db:studio` | Browse the database |

## Layout

```
src/app/page.tsx                 customer + staff/manager UI (single page)
src/app/api/catalog              public catalog (no private notes)
src/app/api/quotes               finalize (public) · list/remove/clear (staff)
src/app/api/events               visit/add/remove tracking for analytics
src/app/api/auth/*               login (role from password) · session · logout
src/app/api/admin/*              manager-only: products, groups, settings, logs, analytics
src/lib/pricing.ts               stock-stage pricing (shared by browser & server)
src/lib/server/*                 db, auth (signed httpOnly cookie), serials, timezone, blob
prisma/schema.prisma             data model
```
