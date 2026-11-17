import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createThrowingStorage } from './helpers/memoryStorage';

const DISMISSED_KEY = 'anuva-notification-prompt-dismissed';
const LAST_PERMISSION_KEY = 'anuva-notification-permission-last';
const LATER_KEY = 'anuva-notification-prompt-later';

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** "Later" tapped today, as the first of the 3 days. */
function laterToday(count = 1): string {
  return JSON.stringify({ count, lastDay: dayKey(new Date()) });
}

type Permission = NotificationPermission;

function stubNotification(permission: Permission, requestPermission?: () => Promise<Permission>) {
  const NotificationMock = {
    permission,
    requestPermission: requestPermission ?? (async () => permission),
  };
  vi.stubGlobal('Notification', NotificationMock);
  vi.stubGlobal('window', {
    ...globalThis,
    Notification: NotificationMock,
  });
  return NotificationMock;
}

async function loadPromptModule() {
  return import('../src/lib/notifications/notificationPrompt');
}

describe('notificationPrompt', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('dismiss / clear / wasDismissed', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('"Later" hides the popup for the rest of today', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(false);
      mod.dismissNotificationPrompt();
      expect(JSON.parse(storage.getItem(LATER_KEY) ?? '{}').count).toBe(1);
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
    });

    it('comes back the next day, on 3 days in all, then stops', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 10, 18, 10));
      vi.stubGlobal('localStorage', createMemoryStorage());
      stubNotification('default');
      const mod = await loadPromptModule();

      for (let day = 0; day < 3; day += 1) {
        vi.setSystemTime(new Date(2026, 10, 18 + day, 10));
        expect(mod.wasNotificationPromptDismissed()).toBe(false);
        mod.dismissNotificationPrompt();
        // A second "Later" the same day does not use up another day.
        mod.dismissNotificationPrompt();
        expect(mod.wasNotificationPromptDismissed()).toBe(true);
      }

      vi.setSystemTime(new Date(2026, 10, 21, 10));
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
    });

    it('an old one-time "Not now" counts as one day and shows again', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage({ [DISMISSED_KEY]: '1' }));
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(false);
    });

    it('clearNotificationPromptDismissed removes the flag', async () => {
      const storage = createMemoryStorage({ [LATER_KEY]: laterToday() });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
      mod.clearNotificationPromptDismissed();
      expect(storage.getItem(LATER_KEY)).toBeNull();
      expect(mod.wasNotificationPromptDismissed()).toBe(false);
    });

    it('treats localStorage failures as not dismissed / no-op writes', async () => {
      vi.stubGlobal('localStorage', createThrowingStorage());
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(false);
      expect(() => mod.dismissNotificationPrompt()).not.toThrow();
      expect(() => mod.clearNotificationPromptDismissed()).not.toThrow();
    });
  });

  describe('syncNotificationPermissionState', () => {
    it('returns denied when Notification is unavailable', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      vi.stubGlobal('window', { ...globalThis });
      // Ensure 'Notification' in window is false
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Notification;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;

      const mod = await loadPromptModule();
      expect(mod.syncNotificationPermissionState()).toBe('denied');
    });

    it('persists the current permission and returns it', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      stubNotification('granted');

      const mod = await loadPromptModule();
      expect(mod.syncNotificationPermissionState()).toBe('granted');
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('granted');
    });

    it('clears dismissed when permission resets from granted/denied to default', async () => {
      const storage = createMemoryStorage({
        [LATER_KEY]: laterToday(3),
        [LAST_PERMISSION_KEY]: 'denied',
      });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.syncNotificationPermissionState()).toBe('default');
      expect(storage.getItem(LATER_KEY)).toBeNull();
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('default');
    });

    it('does not clear dismissed when last was already default', async () => {
      const storage = createMemoryStorage({
        [LATER_KEY]: laterToday(),
        [LAST_PERMISSION_KEY]: 'default',
      });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      mod.syncNotificationPermissionState();
      expect(storage.getItem(LATER_KEY)).toBe(laterToday());
    });
  });

  describe('canPromptForNotifications', () => {
    it('returns false when Notification is missing', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage());
      vi.stubGlobal('window', { ...globalThis });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Notification;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;

      const mod = await loadPromptModule();
      expect(mod.canPromptForNotifications()).toBe(false);
    });

    it('returns false when permission is not default', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage());
      stubNotification('granted');

      const mod = await loadPromptModule();
      expect(mod.canPromptForNotifications()).toBe(false);
    });

    it('returns false when permission is default but prompt was dismissed', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage({ [LATER_KEY]: laterToday() }));
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.canPromptForNotifications()).toBe(false);
    });

    it('returns true when permission is default and not dismissed', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage());
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.canPromptForNotifications()).toBe(true);
    });
  });

  describe('requestNotificationPermission', () => {
    it('returns denied when Notification is unavailable', async () => {
      vi.stubGlobal('localStorage', createMemoryStorage());
      vi.stubGlobal('window', { ...globalThis });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (globalThis as any).Notification;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).Notification;

      const mod = await loadPromptModule();
      await expect(mod.requestNotificationPermission()).resolves.toBe('denied');
    });

    it('returns granted and syncs last permission without dismissing', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      const mock = stubNotification('default', async () => {
        mock.permission = 'granted';
        return 'granted';
      });

      const mod = await loadPromptModule();
      await expect(mod.requestNotificationPermission()).resolves.toBe('granted');
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('granted');
      expect(storage.getItem(LATER_KEY)).toBeNull();
    });

    it('dismisses the in-app prompt when user denies', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      const mock = stubNotification('default', async () => {
        mock.permission = 'denied';
        return 'denied';
      });

      const mod = await loadPromptModule();
      await expect(mod.requestNotificationPermission()).resolves.toBe('denied');
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('denied');
    });
  });
});
