# Anuva — Production Readiness Gaps

> Audit date: 2026-05-28
> Scope: full monorepo (`apps/pwa`, `apps/admin`, `apps/api`, `packages/database`, `packages/shared`)
> Severity legend: 🔴 **Critical** (block launch) · 🟠 **Major** (fix before public traffic) · 🟡 **Moderate** (fix in first iteration post-launch)

---

## 0. Top 10 Immediate Actions

1. 🔴 Rotate Firebase service-account key — `firebase-service-account.json` is in repo working tree (private key id `642b23085ef350364b84c4e7f66a6ff108013592`). Revoke in Firebase console, delete file, switch API to env-var loading.
2. 🔴 Lock CORS — replace `origin: true` with explicit allow-list (`apps/api/src/index.ts:68`).
3. 🔴 Add `requireCurrentUser()` to `DELETE /consultations/slots/:id` (`apps/api/src/index.ts:632`). Anyone can delete unbooked slots today.
4. 🔴 Gate admin panel behind auth — `apps/admin/src/App.tsx:12-19` calls `/api/examples` with no auth check; no route guard.
5. 🔴 Set `SESSION_COOKIE_SECURE=true` for prod env profile (`.env:11-12`).
6. 🔴 Add GDPR endpoints: `DELETE /user`, `GET /user/export` (currently missing across `apps/api/src/index.ts`).
7. 🟠 Add `helmet`, rate-limit middleware (`express-rate-limit`), explicit body-size limit on `express.json()` (`apps/api/src/index.ts:69`).
8. 🟠 Wire error tracking (Sentry) + structured logger (pino/winston) in API and PWA.
9. 🟠 Add test suite + GitHub Actions CI (lint, typecheck, build, prisma validate) — none exist.
10. 🟠 Drop root user in `Dockerfile` runner stage; remove global `prisma` install (`Dockerfile:26-55`).

---

## 1. Security

### 🔴 Critical
- **Firebase service-account JSON in working tree** — `firebase-service-account.json` at repo root. Gitignored (`.gitignore:12`) but still on disk and may be in earlier history. Revoke key, scrub history, load from env.
- **CORS wide open** — `apps/api/src/index.ts:68` `cors({ origin: true, credentials: true })` lets any origin send credentialed requests → CSRF surface.
- **Unauthenticated slot deletion** — `DELETE /consultations/slots/:id` (`apps/api/src/index.ts:632`) skips `requireCurrentUser()`. DoS on booking inventory.
- **Admin app unauthenticated** — `apps/admin/src/App.tsx:12-19` no auth, no route guard.

### 🟠 Major
- **Session cookie not secure** — `.env:11` `SESSION_COOKIE_SECURE="false"`. No prod-profile override visible.
- **FCM token + device id in localStorage** — `apps/pwa/src/lib/notifications/deviceId.ts:5,11`, `firebase.ts:169`. XSS-stealable.
- **Broadcast secret in query string** — `apps/api/src/index.ts:378` reads `req.query.secret`. Leaks via referer/logs. Move to `Authorization` header, constant-time compare.
- **No rate limiting** — no `express-rate-limit`. OTP throttle only DB-count by phone (`index.ts:704-715`), no IP/device. Enables enumeration + brute force.
- **No security headers** — no `helmet`. Missing HSTS, CSP, X-Frame-Options, X-Content-Type-Options.
- **No body size limit** — `express.json()` default 100kb but no explicit cap; no per-route limits.
- **Phone enumeration** — OTP endpoint returns distinct messages for unknown vs throttled accounts (`index.ts:704+`).
- **Firebase init error leaks config** — `apps/api/src/fcm.ts:12-27`, error path at `index.ts:1074-1078`.

### 🟡 Moderate
- **No CSRF token** — cookie-based session + permissive CORS = needs CSRF defence.
- **Demo creds doc** — `CLAUDE.md` mentions `anuva`/`anuva`. Confirm no demo bypass remains in code; remove note.
- **No constant-time compare** for OTP / broadcast secret.

---

## 2. API Hardening (`apps/api`)

### 🟠 Major
- **Single-file API** — `apps/api/src/index.ts` ~1240 lines. Hard to review; route ownership unclear; auth easy to forget on new routes. Split into routers + middleware folder.
- **No central auth middleware** — every route manually calls `requireCurrentUser()`. One miss = exposed route (see DELETE slot).
- **Error handler logs raw `err`** — `index.ts:1225`. Risk of PII/PHI in logs. Replace with sanitised logger + correlation id.
- **Slot booking race** — `index.ts:508-576` relies on `updateMany({ isBooked: false })` count; OK but missing DB unique constraint as second line of defence.
- **No idempotency keys** — POST `/consultations/book`, payment-adjacent flows lack idempotency tokens.
- **No request-id / correlation-id middleware**.

### 🟡 Moderate
- **Zod-only validation** — no sanitisation of strings later echoed in logs/SMS.
- **No response shape contracts** — Zod schemas validate request, not response. Drift risk vs `@anuva/shared`.

---

## 3. Database (`packages/database`)

### 🟠 Major
- **No audit log** — no `updatedBy`, no change tracking. Required for health data.
- **No soft delete** — hard deletes on Consultation, Session, etc. No `deletedAt`.
- **No documented backup/restore** — nothing in README or infra config.
- **Connection pool not tuned** — default Prisma client (`packages/database/src/index.ts:1-9`). No PgBouncer config; serverless deploys will exhaust pool.

### 🟡 Moderate
- **`db:push` vs `migrate dev` mix** — Dockerfile uses `migrate deploy` ✅, but team workflow allows `db:push` → drift risk.
- **Missing compound index** — `OtpChallenge` queries `(phone, purpose, createdAt)` but index is `(phone, createdAt)` (`schema.prisma:106`, query at `index.ts:686-690`).
- **Seed contains real specialist PII** — `apps/api/src/bookingCatalog.ts:17-50+`. Don't run in non-prod without scrubbing.
- **No retention policy** on health/consult data.

---

## 4. Testing & CI

### 🔴 Critical
- **No tests anywhere** — 0 `*.test.*` / `*.spec.*` files. No Vitest/Jest/Playwright config.
- **No CI** — no `.github/workflows`, no GitLab/CircleCI config. Nothing enforces lint/typecheck/build on PRs.

### 🟠 Major
- **No Prisma schema check in CI** — schema drift undetected.
- **No type-coverage gate** — `tsc --noEmit` not enforced pre-merge.

---

## 5. Observability

### 🟠 Major
- **No structured logger** — `console.log/error` throughout (`index.ts:1225,1234,1239`).
- **No error tracker** — no Sentry/Rollbar SDK in API or PWA.
- **No metrics/APM** — no Prom/StatsD/Datadog.
- **Shallow health check** — `/health` returns `{ok:true}` without DB/Firebase ping (`index.ts:422-424`).

### 🟡 Moderate
- **No distributed tracing** (OpenTelemetry).
- **No frontend RUM** (web-vitals not reported).

---

## 6. Build / Deploy

### 🟠 Major
- **Docker runs as root** — `Dockerfile:26-55` no `USER node`/non-root.
- **Global `prisma` install in runtime image** — `Dockerfile:32`. Bloats image, ships CLI.
- **Vercel hardcodes API URL** — `vercel.json:8` `VITE_API_URL=https://api.anuvawellness.com`. Preview deploys point at prod → data pollution.
- **`.dockerignore` excludes `apps/pwa`, `apps/admin`** (`.dockerignore:10-11`) — fine if API-only, but turborepo build graph may pull them. Verify.
- **No secrets management story** — `.env` only. No Vault/SM/Doppler/SSM mention.
- **No SBOM / supply-chain checks** — no `npm audit`, `pnpm audit`, Snyk, Dependabot.

### 🟡 Moderate
- **No `.env.example` parity check** — drift between `.env` and `.env.example` undetected.
- **Builds not reproducible across envs** — no `.nvmrc` / `engines` strict pin verification.

---

## 7. PWA (`apps/pwa`)

### 🟠 Major
- **Service-worker caches auth routes** — `vite.config.ts:74-82` regex `(/\/api/ && !\/api\/auth\//)` is broken JS (`&&` between regex literals returns the second). Auth responses get cached → token replay risk.
- **`registerType: 'autoUpdate'`** — `vite.config.ts:42` forces SW update for all users instantly. No canary.
- **No CSP / SRI on SW imports** — `public/firebase-messaging-sw.js:1-40` imports Firebase from CDN without integrity hash.

### 🟡 Moderate
- **`firebase-config.js` written to public dir** — `vite.config.ts:11-24`. Expected for Firebase web SDK but document it.
- **Notification permission re-prompt** — `notificationPrompt.ts:37-41` no cooldown.
- **No install prompt UX** for PWA add-to-home.

---

## 8. Frontend (PWA + Admin)

### 🟠 Major
- **No React Error Boundaries** — anywhere. One throw = white screen.
- **Accessibility weak** — ~62 aria/role attrs across whole PWA. Form labels, focus traps, contrast not audited. Health app → legal exposure.

### 🟡 Moderate
- **No code splitting / lazy routes** — Firebase, Recharts, etc. eager-loaded.
- **No global loading/error UI** — per-component spinners only.
- **No SEO meta tags** in PWA index.
- **`api.ts` falls back to empty `API_BASE_URL`** — `apps/pwa/src/shared/lib/api.ts:1`. Silent prod misconfig if env var missing.
- **No route guards** — `app/router.tsx` flat router, no `<RequireAuth>` wrapper. CLAUDE.md acknowledges this.

---

## 9. Code Quality

### 🟡 Moderate
- **`console.error` in prod paths** — `apps/api/src/index.ts:1225,1234,1239`; `apps/api/src/seed-booking.ts:6`; `apps/pwa/src/features/auth/AuthProvider.tsx:29`; `AssessmentResultRoute.tsx:66`; `persistOnboardingCompletion.ts:15`; `SubscriptionRoute.tsx:83`.
- **21 `any` occurrences** — review under strict mode.
- **No bundle analyzer** wired (`rollup-plugin-visualizer` etc.).
- **Mock/demo data paths** — verify none reach prod (assessment outcome thresholds, seed catalog).

---

## 10. Compliance / Privacy (health data)

### 🔴 Critical
- **No data export endpoint** — GDPR Art. 20.
- **No account delete + cascading PHI delete** — GDPR Art. 17.

### 🟠 Major
- **No privacy policy / consent UI** in PWA onboarding.
- **No DPA documented** with 2Factor (SMS) and Firebase (FCM) — PII (phone) and device tokens sent off-platform.
- **No retention policy** for assessments, cycle logs, consultations.
- **No encryption-at-rest documentation** for Postgres.
- **No PHI access log** — who-viewed-what audit absent.

### 🟡 Moderate
- **Cookie/consent banner missing**.
- **Assessment + cycle data stored plaintext** — consider field-level encryption for sensitive symptom data.

---

## 11. Operational

### 🟠 Major
- **No runbook** — DB down, deploy rollback, SMS provider outage, FCM outage all undocumented.
- **No on-call doc** — alert routing, SLOs undefined.
- **Secrets in `.env` at repo root** — no rotation policy, no per-env separation documented.
- **Admin panel undocumented** — what is it for, who logs in, how to grant access (also see §1 critical).

### 🟡 Moderate
- **README setup thin** — `README.md` lacks DB bootstrap, migration order, troubleshooting.
- **Migration history** — 6 migration folders but no notes on data backfills or reversibility.

---

## 12. Suggested Sequencing

**Week 1 — block-prod fixes**
- Rotate Firebase key, scrub `firebase-service-account.json`.
- CORS allow-list, helmet, rate-limit, body-size limit.
- Auth middleware refactor + audit every route for `requireCurrentUser()`.
- Admin auth guard.
- Secure cookie flag forced via prod env profile.

**Week 2 — compliance + observability**
- GDPR delete/export endpoints + cascading deletes.
- Privacy policy + consent in onboarding.
- Sentry (API + PWA) + pino structured logging + request id.
- Real `/health` (DB + Firebase Admin ping).

**Week 3 — quality gates**
- Vitest + Playwright smoke tests for auth, booking, cycle.
- GitHub Actions: lint → typecheck → prisma validate → build → test.
- Snyk/Dependabot.

**Week 4 — hardening + ops**
- Error boundaries, route guards, lazy routes, a11y pass.
- Dockerfile non-root, slim runtime, multi-stage tidy.
- Runbooks, backup/restore docs, on-call.
- Audit table + soft delete on PHI models.

---

_End of audit._
