/**
 * Install-funnel events.
 *
 * There is no analytics backend in this repo yet, so events go to a pluggable
 * sink that defaults to a local ring buffer (readable on a real device via
 * `readInstallEvents()`) plus a console line in dev. Wiring a real destination
 * later is one call to `setInstallEventSink` at startup — the event names below
 * are the contract, so they should stay stable even if the sink changes.
 *
 * The two gaps worth watching are `prompt_accepted` -> `first_standalone_session`
 * on Android, where the handoff loses people because the browser cannot launch
 * the app it just installed, and `gate_shown` -> `first_standalone_session` on
 * iOS, which measures whether the Share sheet instructions actually work.
 */

import type { InstallPlatform } from './platform';

export type InstallEventName =
  /** The gate rendered instead of the app. */
  | 'gate_shown'
  /** Visitor is in a webview that cannot install at all. */
  | 'webview_blocked'
  /** Visitor already has the app; we pointed them at it. */
  | 'already_installed_shown'
  /** The browser's install dialog was opened. */
  | 'prompt_shown'
  | 'prompt_accepted'
  | 'prompt_dismissed'
  /** No `beforeinstallprompt` was available, so we showed manual steps. */
  | 'prompt_unavailable'
  /** The browser confirmed installation. */
  | 'app_installed'
  /** The app was opened in standalone mode, ever and per session. */
  | 'first_standalone_session'
  | 'standalone_session'
  /** The dev/testing bypass was used. */
  | 'bypass_used';

export type InstallEvent = {
  name: InstallEventName;
  platform: InstallPlatform | 'unknown';
  at: string;
  detail?: Record<string, string | number | boolean>;
};

type InstallEventSink = (event: InstallEvent) => void;

const BUFFER_KEY = 'anuva-install-events';
const BUFFER_LIMIT = 50;
const FIRST_STANDALONE_KEY = 'anuva-first-standalone-seen';
const SESSION_STANDALONE_KEY = 'anuva-standalone-session-logged';

function bufferSink(event: InstallEvent): void {
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    const events: InstallEvent[] = raw ? JSON.parse(raw) : [];
    events.push(event);
    window.localStorage.setItem(
      BUFFER_KEY,
      JSON.stringify(events.slice(-BUFFER_LIMIT)),
    );
  } catch {
    // Private mode, blocked storage, or a quota error. Losing a funnel event is
    // never worth breaking the screen the visitor is looking at.
  }
}

let sink: InstallEventSink = bufferSink;

export function setInstallEventSink(next: InstallEventSink): void {
  sink = next;
}

export function trackInstallEvent(
  name: InstallEventName,
  platform: InstallPlatform | 'unknown' = 'unknown',
  detail?: Record<string, string | number | boolean>,
): void {
  const event: InstallEvent = { name, platform, at: new Date().toISOString(), ...(detail ? { detail } : {}) };

  if (import.meta.env.DEV) {
    console.info('[install]', name, platform, detail ?? '');
  }

  try {
    sink(event);
  } catch {
    // A broken sink must not take the gate down with it.
  }
}

export function readInstallEvents(): InstallEvent[] {
  try {
    const raw = window.localStorage.getItem(BUFFER_KEY);
    return raw ? (JSON.parse(raw) as InstallEvent[]) : [];
  } catch {
    return [];
  }
}

/**
 * Records that the app was opened in standalone mode. Emits
 * `first_standalone_session` once per install and `standalone_session` once per
 * tab session, so repeat opens are visible without flooding the buffer on every
 * in-app navigation.
 */
export function trackStandaloneSession(platform: InstallPlatform | 'unknown'): void {
  try {
    if (!window.localStorage.getItem(FIRST_STANDALONE_KEY)) {
      window.localStorage.setItem(FIRST_STANDALONE_KEY, new Date().toISOString());
      trackInstallEvent('first_standalone_session', platform);
    }
  } catch {
    // Storage unavailable: fall through and still log the session below.
  }

  try {
    if (window.sessionStorage.getItem(SESSION_STANDALONE_KEY)) return;
    window.sessionStorage.setItem(SESSION_STANDALONE_KEY, '1');
  } catch {
    // Without session storage we cannot dedupe, so skip the per-session event
    // rather than emit one on every mount.
    return;
  }

  trackInstallEvent('standalone_session', platform);
}
