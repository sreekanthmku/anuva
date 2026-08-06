import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createThrowingStorage } from './helpers/memoryStorage';

const DISMISSED_KEY = 'anuva-notification-prompt-dismissed';
const LAST_PERMISSION_KEY = 'anuva-notification-permission-last';

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
    it('dismissNotificationPrompt stores the dismissed flag', async () => {
      const storage = createMemoryStorage();
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(false);
      mod.dismissNotificationPrompt();
      expect(storage.getItem(DISMISSED_KEY)).toBe('1');
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
    });

    it('clearNotificationPromptDismissed removes the flag', async () => {
      const storage = createMemoryStorage({ [DISMISSED_KEY]: '1' });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.wasNotificationPromptDismissed()).toBe(true);
      mod.clearNotificationPromptDismissed();
      expect(storage.getItem(DISMISSED_KEY)).toBeNull();
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
        [DISMISSED_KEY]: '1',
        [LAST_PERMISSION_KEY]: 'denied',
      });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      expect(mod.syncNotificationPermissionState()).toBe('default');
      expect(storage.getItem(DISMISSED_KEY)).toBeNull();
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('default');
    });

    it('does not clear dismissed when last was already default', async () => {
      const storage = createMemoryStorage({
        [DISMISSED_KEY]: '1',
        [LAST_PERMISSION_KEY]: 'default',
      });
      vi.stubGlobal('localStorage', storage);
      stubNotification('default');

      const mod = await loadPromptModule();
      mod.syncNotificationPermissionState();
      expect(storage.getItem(DISMISSED_KEY)).toBe('1');
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
      vi.stubGlobal('localStorage', createMemoryStorage({ [DISMISSED_KEY]: '1' }));
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
      expect(storage.getItem(DISMISSED_KEY)).toBeNull();
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
      expect(storage.getItem(DISMISSED_KEY)).toBe('1');
      expect(storage.getItem(LAST_PERMISSION_KEY)).toBe('denied');
    });
  });
});
