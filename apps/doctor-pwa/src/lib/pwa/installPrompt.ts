/**
 * Captures the browser's install prompt.
 *
 * `beforeinstallprompt` can fire before React mounts, and the event is only usable if it was
 * captured when it fired, so this module registers its listeners at import time and is imported
 * from `main.tsx` ahead of render. Same approach as the patient app (apps/pwa/src/lib/pwa).
 *
 * Calling `preventDefault()` on the event suppresses Chrome's own install infobar on Android. That
 * is deliberate: the install screen is the install surface, and two competing prompts is worse
 * than one. On a desktop, where there is no install screen, the event is left alone so Chrome's
 * own install icon in the address bar still works for anyone who wants it.
 */

import { getInstallPlatform } from './platform';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallPromptSnapshot = {
  /** A captured event is waiting, so the install button can do something. */
  canPrompt: boolean;
  /** The browser told us installation completed during this page's lifetime. */
  installed: boolean;
};

let deferredEvent: BeforeInstallPromptEvent | null = null;
let installed = false;

// useSyncExternalStore compares snapshots by identity, so the cached object is only replaced when
// something actually changed.
let snapshot: InstallPromptSnapshot = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function publish(): void {
  const next: InstallPromptSnapshot = { canPrompt: deferredEvent !== null, installed };
  if (next.canPrompt === snapshot.canPrompt && next.installed === snapshot.installed) {
    return;
  }
  snapshot = next;
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    if (getInstallPlatform() === 'desktop') return;
    event.preventDefault();
    deferredEvent = event as BeforeInstallPromptEvent;
    publish();
  });

  window.addEventListener('appinstalled', () => {
    installed = true;
    // The event is single-use and is void once the app is installed.
    deferredEvent = null;
    publish();
  });
}

export function getInstallPromptSnapshot(): InstallPromptSnapshot {
  return snapshot;
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export type PromptOutcome = 'accepted' | 'dismissed' | 'unavailable';

export async function promptInstall(): Promise<PromptOutcome> {
  const event = deferredEvent;
  if (!event) return 'unavailable';

  // Consumed either way: the browser rejects a second prompt() on the same event, so holding on to
  // it would leave a button that silently fails.
  deferredEvent = null;
  publish();

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return 'unavailable';
  }
}
