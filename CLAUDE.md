# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Monorepo Structure

pnpm + Turborepo workspace with four packages:

| Package | Path | Description |
|---------|------|-------------|
| `@anuva/pwa` | `apps/pwa` | React 18 + Vite PWA — user-facing mobile app |
| `@anuva/admin` | `apps/admin` | React 18 + Vite admin panel |
| `@anuva/api` | `apps/api` | Express + Prisma REST API |
| `@anuva/database` | `packages/database` | Prisma client wrapper (Postgres) |
| `@anuva/shared` | `packages/shared` | Zod schemas shared between API and frontends |

## Commands

```bash
pnpm dev          # all apps concurrently (API :3001, PWA :5173, Admin :5174)
pnpm build        # production build (packages first, then apps)
pnpm lint         # ESLint across all packages

# run a single app
pnpm --filter @anuva/pwa dev
pnpm --filter @anuva/api dev

# database (requires DATABASE_URL in .env)
pnpm db:generate  # prisma generate
pnpm db:migrate   # prisma migrate dev
pnpm db:push      # prisma db push (no migration file)
```

No test suite exists yet.

## Architecture

### PWA (`apps/pwa`)

Feature-folder layout under `src/features/`:

- `auth/` — splash, login, localStorage session (`session.ts`). Demo creds: `anuva`/`anuva`.
- `onboarding/` — multi-step health assessment → scored result → subscription. State lives in `useAssessmentFlow` hook; scoring logic in `data/assessmentOutcome.ts` (threshold 8).
- `core/` — authenticated app shell: dashboard, chat (Anu AI), symptom tracker, weekly report, care direction, library, anonymous Q&A, consultation booking, profile.
- `home/` — `HomeRoute` (landing after login).
- `shared/` — `api.ts` thin fetch wrapper; reusable components.

Router: flat `BrowserRouter` in `app/router.tsx` — no nested route guards yet; navigation is manual `useNavigate`.

State: Jotai atoms (see `apps/admin/src/atoms.ts`). No global store in the PWA yet; local `useState` per feature.

API calls from PWA: `apiFetch<T>()` in `src/shared/lib/api.ts`. In dev, Vite proxies `/api/*` → Express. Set `VITE_API_URL` for a remote origin.

### API (`apps/api`)

Single file: `src/index.ts`. Express app with:
- Zod validation on every route using schemas from `@anuva/shared`
- Prisma via `@anuva/database`
- Global error handler catches `ZodError` → 400, otherwise → 500

### Shared contracts (`packages/shared`)

All API request/response types are Zod schemas here. Import in both API and frontends. Build with `tsc` to `dist/` before use (Turborepo handles ordering).

### Database (`packages/database`)

Single Prisma schema at `packages/database/prisma/schema.prisma`. Exports a singleton `prisma` client. Must run `pnpm db:generate` after schema changes; `build` task does this automatically.

## Design System

`DESIGN.md` defines the **Anuva Wellness** design system (light, warm brand):
- Light theme: `#F7F0E8` cream surface, `#3E2542` plum text
- Primary accent: deep plum `#5E3566`; CTA: dusty rose `#C97E92` (`secondary` token); gold `#B8923C` (`tertiary`) for eyebrows/dividers
- Fonts: **Fraunces** (headings, serif), **Mulish** (body), **Dancing Script** (`font-script`, accent-only — one tagline/hero line), **Space Mono** (mono/numerics)
- Tailwind semantic tokens keep their names (`bg-surface`, `text-on-surface`, `text-primary`…); values are defined in `apps/pwa/tailwind.config.ts`
- Base spacing unit: 8px; use `sp-1` through `sp-8`
- All buttons pill-shaped (9999px radius); minimum tap target 44px; warm plum-tinted shadows (no heavy black, no glows)

## Key Conventions

- All new API contracts go in `@anuva/shared` as Zod schemas; derive TypeScript types with `z.infer`.
- After editing `packages/database/prisma/schema.prisma`, run `pnpm db:generate` then rebuild the package.
- Workspace packages must be built before apps that import them (`turbo` handles this, but `tsc --noEmit` in the PWA will fail if `@anuva/shared` dist is stale).
- `.env` lives at repo root; API loads it via `dotenv` relative to `apps/api/src/`.
