/**
 * Lets the team reach the portal in a phone browser, past the install screen.
 *
 * Always on in dev, since `pnpm dev` runs in a browser tab. In a production build it takes
 * `?browser=1`, which keeps support calls and quick checks on a phone workable.
 *
 * Held in sessionStorage rather than re-read from the URL on every navigation, because
 * react-router drops the query string as soon as you move within the app. Session storage is
 * per-tab and dies with it.
 */

const BYPASS_PARAM = 'browser';
const BYPASS_KEY = 'anuva-doctor-gate-bypass';

function readStoredBypass(): boolean {
  try {
    return window.sessionStorage.getItem(BYPASS_KEY) === '1';
  } catch {
    return false;
  }
}

function storeBypass(): void {
  try {
    window.sessionStorage.setItem(BYPASS_KEY, '1');
  } catch {
    // Without session storage the bypass lasts until the next navigation; the URL flag still works.
  }
}

export function isGateBypassed(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;

  const fromUrl = new URLSearchParams(window.location.search).get(BYPASS_PARAM) === '1';
  if (fromUrl) storeBypass();

  return fromUrl || readStoredBypass();
}
