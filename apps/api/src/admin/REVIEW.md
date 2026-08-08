# Admin module review

## Verdict

**Ready for staging** with env secrets configured. Core requirements met: separate `/admin` layer, env-based auth, full entity registry coverage, validation, redaction, tests. Harden secrets and rate-limit login before public production exposure.

## Entity coverage

All **61** Prisma models are registered in `ADMIN_ENTITIES` (verified by `tests/admin/registry.test.ts`).

## Security findings

1. **High — login brute force**: `/admin/auth/login` has no rate limit. Mitigate at reverse proxy or add app-level throttle before internet exposure.
2. **Medium — session secret derivation**: In non-production, secret can derive from password if `ADMIN_SESSION_SECRET` is unset. Production requires an explicit secret (empty ⇒ auth fail-closed).
3. **Medium — privileged surface**: Full CRUD over PHI. Restrict network access to admin UI/API (VPN / IP allowlist).
4. **Low — doctor-accounts**: `password` is accepted in create/update bodies and hashed with scrypt before it reaches Prisma; ensure TLS and no request-body logging (logger already avoids bodies).

## Architecture findings

- Clean Routes → Controllers → Services → Repositories separation held.
- No dependency on patient/doctor route handlers.
- Generic registry scales; some log entities use looser schemas by design.
- Admin error handler on the router; host app also maps `AdminError` as a safety net.

## Must-fix before production

- [ ] Set strong unique `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`
- [ ] Confirm logger redacts `authorization` and `x-admin-token` (done)
- [ ] Put admin behind private network / auth gateway
- [ ] Add login rate limiting at the edge

## Nice-to-haves

- Structured field editors in the Admin UI (beyond JSON)
- Audit log of admin mutations
- Soft-delete default for more entities
- CSRF considerations if cookie-based auth is ever added (currently Bearer-only)
