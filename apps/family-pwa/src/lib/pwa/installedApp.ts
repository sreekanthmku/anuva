/**
 * "Does this visitor already have the app installed?"
 *
 * Only used to replace a dead install button with a pointer to the app: once
 * installed, `beforeinstallprompt` never fires again, so without this check an
 * already-installed visitor in a browser tab would see a button that does
 * nothing at all.
 *
 * Requires a `related_applications` entry in the manifest naming this same
 * origin (see vite.config.ts). Chromium only; everywhere else this resolves
 * false and the caller falls back to the normal per-platform screen.
 */

type RelatedApp = { platform?: string; url?: string; id?: string };

type RelatedAppsNavigator = Navigator & {
  getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
};

/**
 * The call is present but never settles in some Chromium builds — it was
 * observed hanging indefinitely when the user agent claims iOS. The gate waits
 * on this answer before it can pick a screen, so a pending promise leaves the
 * visitor looking at a bare logo forever. Assume "not installed" and move on.
 */
const LOOKUP_TIMEOUT_MS = 1200;

export async function isAppAlreadyInstalled(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  const getInstalledRelatedApps = (navigator as RelatedAppsNavigator).getInstalledRelatedApps;
  if (typeof getInstalledRelatedApps !== 'function') return false;

  const lookup = getInstalledRelatedApps
    .call(navigator)
    .then((apps) => apps.some((app) => app.platform === 'webapp'))
    // Unsupported, blocked by policy, or a non-secure context.
    .catch(() => false);

  const timeout = new Promise<boolean>((resolve) => {
    window.setTimeout(() => resolve(false), LOOKUP_TIMEOUT_MS);
  });

  return Promise.race([lookup, timeout]);
}
