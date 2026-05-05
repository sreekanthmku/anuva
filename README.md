# Anuva monorepo

pnpm + Turborepo workspace: **PWA** (`apps/pwa`), **Admin** (`apps/admin`), **API** (`apps/api`), shared **Prisma** (`packages/database`) and **Zod** contracts (`packages/shared`).

## Prerequisites

- Node.js 20+
- pnpm 9 (`corepack enable` then `corepack prepare pnpm@9.15.0 --activate`)
- A Postgres instance and `DATABASE_URL` when you run migrations or hit DB-backed routes

## Setup

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL
pnpm install
pnpm build
```

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Runs `dev` in all apps (builds workspace dependencies first). API: `http://localhost:3001`, PWA: `http://localhost:5173`, Admin: `http://localhost:5174` |
| `pnpm build` | Production builds for packages and apps |
| `pnpm lint` | ESLint across packages that define `lint` |
| `pnpm db:generate` | `prisma generate` in `@anuva/database` |
| `pnpm db:migrate` | `prisma migrate dev` (requires `DATABASE_URL`) |
| `pnpm db:push` | `prisma db push` for quick schema sync |

## API routes (examples)

- `GET /health` — liveness
- `GET /examples` — list rows from `Example`
- `POST /examples` — JSON `{ "name": "..." }` (validated with Zod from `@anuva/shared`)

## Frontends and API

In dev, Vite proxies `/api/*` to the Express app, so the PWA and Admin call paths like `/api/examples` without CORS issues.

To point the PWA at a remote API, set `VITE_API_URL` (full origin, no trailing slash); otherwise it uses the dev proxy.

## Database migrations

With `DATABASE_URL` set:

```bash
pnpm db:migrate
```

The repo includes an initial migration for the `Example` model under `packages/database/prisma/migrations/`.
