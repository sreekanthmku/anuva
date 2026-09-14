/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_FREE_TRIAL_DAYS?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
  readonly VITE_FIREBASE_VAPID_KEY?: string;
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Injected by `vite.config.ts` via `define`, so both are literals by the time the bundle is built.
 *
 * `__BETA_MODE__` being a literal means every `if (__BETA_MODE__)` folds to a constant: with beta
 * off the reporter never mounts, never attaches a motion listener, and never fetches the screenshot
 * chunk (~26KB, split out by its dynamic import and requested only when someone opens the sheet).
 * The sheet's own markup is a few KB and is present in the bundle either way — measured at ~4KB
 * between a beta-on and beta-off build, which is not worth further splitting.
 */
declare const __BUILD_ID__: string;
declare const __BETA_MODE__: boolean;
