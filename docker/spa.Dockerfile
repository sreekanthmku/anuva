# One image for every Vite SPA in the monorepo, picked with the APP build arg:
#   pwa         patient app   app.<domain>
#   doctor-pwa  doctor portal doctor.<domain>
#   family-pwa  family app    family.<domain>
#   admin       admin panel   admin.<domain>
#
# Coolify: Build Pack "Dockerfile", Base Directory "/", Dockerfile Location "/docker/spa.Dockerfile",
# port 80. Set APP and the VITE_* values as *build* variables — Vite inlines them at build time, so
# changing one needs a redeploy, not a restart. See docs/SERVER_MIGRATION.md §7.
#
# The build skips turbo on purpose: turbo strips env vars it was not told about (turbo.json only
# declares VITE_*), which would silently drop SENTRY_* and ALLOW_MISSING_FIREBASE. pnpm's
# "<pkg>..." filter builds @anuva/shared first and then the app, with the full environment.

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

ARG APP
RUN case "$APP" in pwa|doctor-pwa|family-pwa|admin) ;; \
      *) echo "APP build arg must be one of: pwa doctor-pwa family-pwa admin (got '$APP')" >&2; exit 1 ;; \
    esac

# Build-time configuration. Each ARG is visible to the RUN steps below as an env var, which is
# how Vite's loadEnv/import.meta.env pick them up. Unset ones are simply empty.
ARG VITE_API_URL
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_MESSAGING_SENDER_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_FIREBASE_VAPID_KEY
ARG VITE_FREE_TRIAL_DAYS
ARG VITE_BETA_EMAIL_LOGIN_ENABLED
ARG VITE_BETA_MODE
ARG VITE_SENTRY_DSN
ARG SENTRY_AUTH_TOKEN
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG ALLOW_MISSING_FIREBASE

# Fail the build rather than ship an app that calls its own origin (see SERVER_MIGRATION.md §7).
RUN test -n "$VITE_API_URL" || { echo "VITE_API_URL build variable is not set" >&2; exit 1; }

COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@anuva/${APP}..."
RUN pnpm --filter "@anuva/${APP}..." run build


FROM nginx:1.27-alpine
ARG APP
COPY docker/nginx-spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/${APP}/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
