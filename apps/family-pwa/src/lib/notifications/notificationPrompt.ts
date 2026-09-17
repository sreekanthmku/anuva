/**
 * When to ask, and when to stop asking.
 *
 * The browser gives one shot at its own permission dialog per site — a dismissal there is close to
 * permanent — so our card goes first and explains what the notification is for. That card is what
 * these helpers gate.
 *
 * "Not now" on our card is *not* treated as a final answer. This app is worth almost nothing to a
 * family member without the notification: the whole loop is she opens your note, she taps thank
 * you, you hear about it. Someone who taps past the card on their first evening and never sees it
 * again silently drops out of that loop. So the dismissal is held per app session and the ask comes
 * back the next time they open the app — asked again, not nagged in the same sitting.
 *
 * The one permanent stop is a hard `denied` from the browser. `requestPermission` resolves
 * instantly without showing anything after that, so re-asking could only produce a card whose
 * button does nothing.
 */

const DISMISSED_KEY = 'anuva-family-notification-prompt-dismissed';
const BLOCKED_KEY = 'anuva-family-notification-prompt-blocked';
const LAST_PERMISSION_KEY = 'anuva-family-notification-permission-last';

/** Session-scoped: dies with the tab or the app, which is what brings the ask back. */
export function wasPromptDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPrompt(): void {
  try {
    sessionStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** The browser said no and will not ask again. Stop showing our card for good. */
export function blockPrompt(): void {
  try {
    localStorage.setItem(BLOCKED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function wasPromptBlocked(): boolean {
  try {
    return localStorage.getItem(BLOCKED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Someone who resets site permissions is asking to be asked again. Honour it. */
export function syncPermissionState(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  const current = Notification.permission;

  try {
    const last = localStorage.getItem(LAST_PERMISSION_KEY);
    if (current === 'default' && last && last !== 'default') {
      localStorage.removeItem(BLOCKED_KEY);
      sessionStorage.removeItem(DISMISSED_KEY);
    }
    localStorage.setItem(LAST_PERMISSION_KEY, current);
  } catch {
    /* ignore */
  }

  return current;
}

export function canPromptForNotifications(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  return syncPermissionState() === 'default' && !wasPromptBlocked() && !wasPromptDismissed();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  syncPermissionState();

  // A hard "no" from the browser cannot be re-asked, so stop showing our card as well.
  if (permission === 'denied') {
    blockPrompt();
  }

  return permission;
}
