# 3D2GO

Filament store. The customer-facing store is not built yet; everything lives in the **Backstore** at `/backstore`:

- **Dashboard**: today's sales, month profit, stock value, incoming rolls, low stock, reservations.
- **Stock**: filament SKUs (Brand, Type, Color, SKU, Amt, Cost, Ref, Mark), stock adjustments, movement history.
- **Purchase orders**: record supplier orders in SGD or THB, mark shipped, receive into stock.
- **POS**: sell or reserve rolls; reservations hold stock until picked up or cancelled.
- **Sales & reservations**: complete / cancel reservations, void sales.
- **Spools** (print service, filament2go): rolls opened for printing, each with a serial and a QR label.
  Scan a spool, weigh it before the print and again after; the difference is the filament used and its cost.
- **Users**: accounts are stored in the database with a role, `USER` (default) or `ADMIN`.
  Only admins can sign in to the backstore; an admin can add accounts and promote or demote other users.

Stack: Next.js 16 (App Router, Server Actions), shadcn/ui, Tailwind v4, Prisma 7 + PostgreSQL,
react-hot-toast, IBM Plex Sans Thai.

## ต้นทุนต่อม้วน (landed cost per roll)

Item prices on a purchase order can be in SGD, but what matters is the THB you actually paid
(items + shipping − discount, after FX). On **Receive** you enter that THB total and it is split across
the lines **in proportion to each line's value**:

```
20 SGD (1 roll) + 30 SGD (2 rolls), paid 1,300 THB
→ line 1: 20/50 × 1300 = 520 THB → 520 / roll
→ line 2: 30/50 × 1300 = 780 THB → 390 / roll
```

Each product's **Cost** is a weighted average: received rolls are blended with the rolls already
on hand. Sales snapshot that cost so profit stays correct later. The maths is in `lib/costing.ts`
(tested in `lib/costing.test.ts`).

## Spool weighing (filament2go)

Opening a spool takes one roll out of stock, weighs it full on its reel, and gives it a serial (`SP-YYMMDD-001`)
whose QR label links to the spool's page. Every job is weighed in before printing and out afterwards:

```
used = before − after          left = last weight − empty reel
cost = used × roll cost ÷ full-roll grams
```

Reels and filament differ, so each brand + type has its own empty-reel weight, full-roll grams and density
(**Spools → Reel weights**), copied onto each spool when it is opened. A job can name the filament type it
was sliced for; a spool of another type is refused. The maths is in `lib/spool.ts` (tested in `lib/spool.test.ts`).

## Getting started

```bash
pnpm install
cp .env.example .env            # then fill it in (see below)
docker compose up -d            # local Postgres on :5432 (or use Neon/Supabase)
pnpm db:migrate                 # create tables
pnpm db:seed                    # optional sample filament
pnpm create-admin you@example.com "your-password"   # first admin account
pnpm dev                        # http://localhost:3000/backstore
```

`.env`:

| Variable | How to set it |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `DATABASE_POOL_MAX` | only `1` when using `npx prisma dev` instead of a real Postgres |

## Scripts

| Script | Does |
| --- | --- |
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js |
| `pnpm test` | unit tests (costing, spool weighing, …) |
| `pnpm db:migrate` / `pnpm db:deploy` | Prisma migrations (dev / production) |
| `pnpm db:seed` | sample products (skipped if products exist) |
| `pnpm db:studio` | browse the database |
| `pnpm create-admin <email> <password> [name]` | create an admin, or promote an existing account and set its password |

## Project layout

```
app/backstore/login         sign-in page + login/logout actions
app/backstore/(app)/        dashboard, stock, orders, pos, sales, spools (+ each area's actions.ts)
components/backstore/       shared backstore UI (dialogs, cost breakdown, nav)
components/brand/logo.tsx   logo mark + wordmark
lib/costing.ts              landed-cost and weighted-average maths
lib/spool.ts                spool weighing maths (remaining, used, cost, checks)
lib/db.ts                   Prisma client
lib/auth.ts                 current user + requireAdmin() guard used by every backstore page/action
proxy.ts                    redirects signed-out visitors to /backstore/login
prisma/schema.prisma        data model
```
