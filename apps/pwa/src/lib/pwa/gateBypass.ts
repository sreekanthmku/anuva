/**
 * Lets the team reach the app in a browser, past the install gate.
 *
 * Always on in dev, since `pnpm dev` runs in a browser tab and the gate would
 * otherwise block all local work. In a production build it takes `?browser=1`,
 * which is what makes preview deploys and support calls workable — Vercel
 * previews are production builds, so the dev flag alone does not cover them.
 *
 * The flag is held in sessionStorage rather than re-read from the URL on every
 * navigation, because react-router drops the query string as soon as you move
 * within the app and the bypass would evaporate mid-session. Session storage is
 * per-tab and dies with it, so this does not make the bypass any easier to
 * spread than the URL already does.
 *
 * Every use is tracked so an unexpectedly popular bypass shows up in the funnel
 * rather than quietly inflating the browser-side numbers.
 */

import { getInstallPlatform } from './platform';
import { trackInstallEvent } from './installAnalytics';

const BYPASS_PARAM = 'browser';
const BYPASS_KEY = 'anuva-gate-bypass';

let tracked = false;

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
    // Without session storage the bypass lasts until the next navigation. The
    // URL flag still works, so this stays usable, just less convenient.
  }
}

export function isGateBypassed(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === 'undefined') return false;

  const fromUrl = new URLSearchParams(window.location.search).get(BYPASS_PARAM) === '1';
  if (fromUrl) storeBypass();

  const bypassed = fromUrl || readStoredBypass();

  if (bypassed && !tracked) {
    tracked = true;
    trackInstallEvent('bypass_used', getInstallPlatform());
  }

  return bypassed;
}
