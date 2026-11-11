// Getting a new deploy onto an installed app.
//
// vite.config.ts builds the service worker with registerType 'prompt' and injectRegister false: the
// worker downloads a new version in the background and then *waits*, and this module registers it
// and decides when to switch, by the rule in @anuva/shared (appUpdate.ts). Before this, the worker
// took over on its own but nothing reloaded the page, so a new deploy only showed after the app had
// been fully killed and reopened — often several times, since swiping an installed app away usually
// just backgrounds it.
//
// It also asks for a new version whenever the app comes back on screen and every 30 minutes while it
// is open: an installed app that is only ever resumed never loads a page, and a page load is the only
// time the browser checks by itself.
//
// Copies of this file live in the patient, doctor and family apps; keep them the same.
import { useEffect, useSyncExternalStore } from 'react';
import { APP_UPDATE_CHECK_INTERVAL_MS, decideAppUpdate, isFreshReturn } from '@anuva/shared';

/** Waiting longer than this for the new worker to take over means it never will; reload anyway. */
const TAKEOVER_TIMEOUT_MS = 4_000;
/**
 * On coming back, how long to let a notification tap land before deciding. A tap brings the app
 * forward and hands it a destination (a gift, a note) a moment later; deciding at once could reload
 * over it, losing the card it was about to open. Once the card is up, it holds the update itself.
 */
const RESUME_SETTLE_MS = 1_500;
const TEXT_INPUT_TYPES = new Set(['text', 'email', 'tel', 'number', 'search', 'url', 'password']);

let started = false;
let registration: ServiceWorkerRegistration | null = null;
/** A newer worker took over this page without us asking (another window applied the update). */
let takenOver = false;
let applying = false;
let reloading = false;
let holds = 0;
/** When the app opened, or last came back after being away long enough to count as fresh. */
let freshSince = Date.now();
let lastTouchAt = 0;
let hiddenAt: number | null = null;
/** "Not now" on the bar: stay quiet until the app next comes back on screen. */
let dismissed = false;
let offered = false;
const listeners = new Set<() => void>();

function setOffered(next: boolean): void {
  if (offered === next) return;
  offered = next;
  listeners.forEach((listener) => listener());
}

function updateReady(): boolean {
  return Boolean(registration?.waiting) || takenOver;
}

/** Any visible, editable text field with something typed in it. */
function hasTypedText(): boolean {
  const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
  for (const field of fields) {
    if (field.disabled || field.readOnly || field.value.trim() === '') continue;
    if (field instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(field.type)) continue;
    if (field.getClientRects().length === 0) continue;
    return true;
  }
  return false;
}

function reload(): void {
  if (reloading) return;
  reloading = true;
  window.location.reload();
}

function evaluate(): void {
  if (applying || !updateReady() || document.visibilityState !== 'visible') {
    setOffered(false);
    return;
  }
  const decision = decideAppUpdate({
    held: holds > 0,
    untouched: lastTouchAt < freshSince,
    hasTypedText: hasTypedText(),
  });
  if (decision === 'reload') {
    applyAppUpdate();
    return;
  }
  setOffered(decision === 'offer' && !dismissed);
}

function checkForUpdate(): void {
  if (!registration || applying || document.visibilityState !== 'visible') return;
  // Offline or a flaky network: the next return to the app or the next interval tries again.
  registration.update().catch(() => undefined);
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'hidden') {
    hiddenAt = Date.now();
    return;
  }
  if (hiddenAt !== null && isFreshReturn(Date.now() - hiddenAt)) freshSince = Date.now();
  hiddenAt = null;
  dismissed = false;
  checkForUpdate();
  window.setTimeout(evaluate, RESUME_SETTLE_MS);
}

async function register(): Promise<void> {
  try {
    registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      // Always fetch sw.js itself from the network, never the HTTP cache.
      updateViaCache: 'none',
    });
  } catch {
    // No worker (private mode, storage blocked): the app still works, it just is not installable
    // offline. Nothing to update.
    return;
  }
  registration.addEventListener('updatefound', () => {
    const worker = registration?.installing;
    worker?.addEventListener('statechange', () => {
      // `controller` set means this is an update, not the very first install.
      if (worker.state === 'installed' && navigator.serviceWorker.controller) evaluate();
    });
  });
  evaluate();
}

/** Starts the update checks. Production builds only: there is no service worker in dev. */
export function startAppUpdates(): void {
  if (started || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  started = true;

  const hadController = navigator.serviceWorker.controller !== null;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (applying) {
      reload();
      return;
    }
    if (hadController) {
      takenOver = true;
      evaluate();
    }
  });

  const touched = () => {
    lastTouchAt = Date.now();
  };
  window.addEventListener('pointerdown', touched, { capture: true, passive: true });
  window.addEventListener('keydown', touched, { capture: true, passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.setInterval(checkForUpdate, APP_UPDATE_CHECK_INTERVAL_MS);

  if (document.readyState === 'complete') void register();
  else window.addEventListener('load', () => void register(), { once: true });
}

/** Switches to the downloaded version now: the new worker takes over and the page reloads. */
export function applyAppUpdate(): void {
  if (applying) return;
  applying = true;
  setOffered(false);
  const waiting = registration?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  // The controllerchange listener reloads once it has taken over.
  waiting.postMessage({ type: 'SKIP_WAITING' });
  window.setTimeout(reload, TAKEOVER_TIMEOUT_MS);
}

/** Hides the bar until the app next comes back on screen. */
export function dismissAppUpdate(): void {
  dismissed = true;
  setOffered(false);
}

/**
 * Keeps the app on this version while `active`: no reload and no bar. For screens where a reload
 * loses something that cannot be got back — a live call, or a code the person is about to type
 * from the voice call (they leave the app to answer it, and come back to an empty field).
 */
export function useHoldAppUpdate(active = true): void {
  useEffect(() => {
    if (!active) return;
    holds += 1;
    evaluate();
    return () => {
      holds -= 1;
      evaluate();
    };
  }, [active]);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether to show the "new version" bar. */
export function useAppUpdateOffered(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => offered,
    () => false,
  );
}
