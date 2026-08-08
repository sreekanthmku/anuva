# Admin API

Dedicated Admin surface for managing every Prisma entity. Completely separate from patient and doctor APIs.

## Architecture

```
Routes → Controllers → Services → Repositories
```

| Layer | Role |
|-------|------|
| `routes/` | Express routers, auth gating |
| `controllers/` | HTTP in/out only |
| `services/` | Auth + entity business rules / actions |
| `repositories/` | Prisma data access |
| `entities/registry.ts` | Declarative resource catalog (schemas, search, actions) |
| `middleware/` | Auth + centralized error handler |
| `lib/` | Crypto, pagination, serialization |

Mounted once from the host app:

```ts
app.use('/admin', createAdminRouter({ prisma }));
```

No patient/doctor handlers are reused.

## Authentication

1. `POST /admin/auth/login` with `{ "password": "..." }` matching `ADMIN_PASSWORD`
2. Response: `{ token, expiresAt, expiresInSeconds }` — HMAC-SHA256 signed session (payload.signature)
3. Send token as `Authorization: Bearer <token>` or `x-admin-token: <token>`
4. `GET /admin/auth/me` and all `/admin/entities/*` require a valid token
5. `POST /admin/auth/logout` is authenticated; tokens are stateless (client discards)

Fail-closed: unset `ADMIN_PASSWORD` ⇒ every login is rejected.

Timing-safe password and signature compares are used throughout.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | yes (prod) | Admin login password |
| `ADMIN_SESSION_SECRET` | yes in production | HMAC secret for session tokens |
| `ADMIN_SESSION_TTL_HOURS` | no (default `12`) | Token lifetime |

See repo-root `.env.example`.

## Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/health` | Liveness for the admin module |
| POST | `/admin/auth/login` | Exchange password for session token |

### Authenticated

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/auth/me` | Current admin session |
| POST | `/admin/auth/logout` | Client-side logout acknowledgement |
| GET | `/admin/entities/meta` | List all manageable resources (UI catalog) |
| GET | `/admin/entities/:resource` | List + search/filter/sort/paginate |
| GET | `/admin/entities/:resource/:id` | Get one |
| POST | `/admin/entities/:resource` | Create |
| PATCH/PUT | `/admin/entities/:resource/:id` | Update |
| DELETE | `/admin/entities/:resource/:id` | Delete |
| POST | `/admin/entities/:resource/:id/actions/:action` | Entity-specific action |

### List query params

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | ≥ 1 |
| `pageSize` | 25 | 1–100 |
| `sort` | entity default | Must be in `sortableFields` |
| `order` | `desc` | `asc` \| `desc` |
| `q` | — | OR search across `searchFields` |
| `filter` | — | JSON object of equality filters (`filterFields` only) |

### Response shapes

- List: `{ data: T[], meta: { page, pageSize, total, totalPages, sort, order } }`
- One / create / update / delete / action: `{ data: T }`
- Errors: `{ error, code, details? }`

Sensitive fields (`tokenHash`, `accessKeyHash`, `embedding`, `providerSessionId`) are redacted in responses.

## Validation

- Zod schemas per entity in the registry (`createSchema` / `updateSchema`)
- Readonly fields (`id`, `createdAt`, `updatedAt`, hashes) stripped before parse
- List query validated via `listQuerySchema`
- Prisma unique/FK failures mapped to 409 / 400

## Entity-specific actions

| Resource | Actions |
|----------|---------|
| `symptoms`, `specialists` | `enable`, `disable` |
| `fcm-tokens` | `activate`, `deactivate` |
| `consultation-documents` | `archive`, `restore` (soft delete via `deletedAt`) |
| `specialists` | `rotate-access-key` (returns plaintext key once) |

## Admin UI (`apps/admin`)

- Vite on `:5174`, proxies `/api/*` → API (`/api/admin/...` → `/admin/...`)
- Login stores Bearer token in `localStorage`
- Sidebar driven by `GET /admin/entities/meta`
- Generic JSON CRUD browser for every resource

## Tests

```bash
pnpm --filter @anuva/api test
# or only admin:
pnpm --filter @anuva/api exec vitest run --config tests/vitest.config.ts tests/admin
```

Tests import production modules only (no test flags / test-only routes). API tests mount `createAdminRouter` on a minimal Express app with a mocked Prisma client.

## Project structure

```
apps/api/src/admin/
  index.ts
  config.ts
  errors.ts
  controllers/
  services/
  repositories/
  routes/
  middleware/
  entities/
  lib/
apps/api/tests/admin/
apps/admin/src/   # React admin UI
```
