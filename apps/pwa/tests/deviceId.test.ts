import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage, createThrowingStorage } from './helpers/memoryStorage';

const DEVICE_ID_KEY = 'anuva-device-id';

describe('getOrCreateDeviceId', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns an existing id from localStorage without creating a new one', async () => {
    const storage = createMemoryStorage({ [DEVICE_ID_KEY]: 'existing-device-id' });
    vi.stubGlobal('localStorage', storage);
    const randomUUID = vi.fn(() => 'should-not-be-called');
    vi.stubGlobal('crypto', { randomUUID });

    const { getOrCreateDeviceId } = await import('../src/lib/notifications/deviceId');
    expect(getOrCreateDeviceId()).toBe('existing-device-id');
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it('creates, persists, and returns a new UUID when none exists', async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('crypto', { randomUUID: () => 'new-uuid-1234' });

    const { getOrCreateDeviceId } = await import('../src/lib/notifications/deviceId');
    expect(getOrCreateDeviceId()).toBe('new-uuid-1234');
    expect(storage.getItem(DEVICE_ID_KEY)).toBe('new-uuid-1234');
  });

  it('falls back to crypto.randomUUID when localStorage throws', async () => {
    vi.stubGlobal('localStorage', createThrowingStorage());
    vi.stubGlobal('crypto', { randomUUID: () => 'ephemeral-uuid' });

    const { getOrCreateDeviceId } = await import('../src/lib/notifications/deviceId');
    expect(getOrCreateDeviceId()).toBe('ephemeral-uuid');
  });
});
