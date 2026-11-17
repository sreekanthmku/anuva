const DISMISSED_KEY = 'anuva-notification-prompt-dismissed';
const LAST_PERMISSION_KEY = 'anuva-notification-permission-last';

/** "Later" brings the popup back the next day she opens the app, for 3 days, then stops. */
const LATER_KEY = 'anuva-notification-prompt-later';
const MAX_DAYS_SHOWN = 3;

type LaterState = { count: number; lastDay: string | null };

function todayKey(now = new Date()): string {
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function readLater(): LaterState {
  try {
    const raw = localStorage.getItem(LATER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LaterState>;
      return {
        count: typeof parsed.count === 'number' ? parsed.count : 0,
        lastDay: typeof parsed.lastDay === 'string' ? parsed.lastDay : null,
      };
    }
    // Before this, one "Not now" hid the popup for good. Count it as one day, shown again today.
    if (localStorage.getItem(DISMISSED_KEY) === '1') return { count: 1, lastDay: null };
  } catch {
    /* ignore */
  }
  return { count: 0, lastDay: null };
}

/** True once "Later" has been tapped today, or on all 3 days. */
export function wasNotificationPromptDismissed(): boolean {
  const { count, lastDay } = readLater();
  return count >= MAX_DAYS_SHOWN || lastDay === todayKey();
}

export function dismissNotificationPrompt(): void {
  const { count, lastDay } = readLater();
  const today = todayKey();
  try {
    localStorage.setItem(
      LATER_KEY,
      JSON.stringify({ count: lastDay === today ? count : count + 1, lastDay: today })
    );
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

export function clearNotificationPromptDismissed(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
    localStorage.removeItem(LATER_KEY);
  } catch {
    /* ignore */
  }
}

/** When the user resets site notification permission, allow the in-app prompt again. */
export function syncNotificationPermissionState(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const current = Notification.permission;

  try {
    const last = localStorage.getItem(LAST_PERMISSION_KEY);
    if (current === 'default' && last && last !== 'default') {
      clearNotificationPromptDismissed();
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

  syncNotificationPermissionState();

  if (Notification.permission !== 'default') {
    return false;
  }

  return !wasNotificationPromptDismissed();
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  syncNotificationPermissionState();

  if (permission === 'denied') {
    dismissNotificationPrompt();
  }

  return permission;
}
