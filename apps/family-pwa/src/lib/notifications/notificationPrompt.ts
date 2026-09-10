/**
 * When to ask, and when to stop asking.
 *
 * The browser gives one shot at the permission dialog per site — a dismissal is close to permanent
 * — so the ask is preceded by our own card explaining what the notifications are for. That card is
 * what these helpers gate: `default` permission, not already dismissed, and nothing else.
 */

const DISMISSED_KEY = 'anuva-family-notification-prompt-dismissed';
const LAST_PERMISSION_KEY = 'anuva-family-notification-permission-last';

export function wasPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissPrompt(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* ignore */
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
      localStorage.removeItem(DISMISSED_KEY);
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

  return syncPermissionState() === 'default' && !wasPromptDismissed();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  syncPermissionState();

  // A hard "no" from the browser cannot be re-asked, so stop showing our card as well.
  if (permission === 'denied') {
    dismissPrompt();
  }

  return permission;
}
