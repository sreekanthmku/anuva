const DISMISSED_KEY = 'anuva-notification-prompt-dismissed';
const LAST_PERMISSION_KEY = 'anuva-notification-permission-last';

export function wasNotificationPromptDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissNotificationPrompt(): void {
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function clearNotificationPromptDismissed(): void {
  try {
    localStorage.removeItem(DISMISSED_KEY);
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
