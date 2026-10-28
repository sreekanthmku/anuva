import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from './helpers/memoryStorage';

// What stays on a device after sign-out, or after the app finds her session gone: nothing of hers,
// only the language the device was set to.

vi.mock('../src/lib/sentry', () => ({ setSentryUser: vi.fn() }));

const local = createMemoryStorage();
const session = createMemoryStorage();
vi.stubGlobal('localStorage', local);
vi.stubGlobal('sessionStorage', session);

const { markSignedIn, wasSignedIn, wipeDeviceData } = await import('../src/lib/wipeDeviceData');
const { setSentryUser } = await import('../src/lib/sentry');

beforeEach(() => {
  local.clear();
  session.clear();
});

describe('wipeDeviceData', () => {
  it('clears her data from both storages and keeps only the language', async () => {
    local.setItem('anuva.lang', 'hi');
    local.setItem('anuva-device-id', 'device-1');
    local.setItem('anuva-fcm-token', 'https://push.example/endpoint');
    session.setItem('anuva-assessment-progress', '{"answers":{}}');
    session.setItem('anuva-assessment-result', '{"score":9}');

    await wipeDeviceData();

    expect(local.getItem('anuva.lang')).toBe('hi');
    expect(local.getItem('anuva-device-id')).toBeNull();
    expect(local.getItem('anuva-fcm-token')).toBeNull();
    expect(session.getItem('anuva-assessment-progress')).toBeNull();
    expect(session.getItem('anuva-assessment-result')).toBeNull();
    expect(setSentryUser).toHaveBeenCalledWith(null);
  });

  it('forgets that anyone was signed in, so it runs once per lost session', async () => {
    markSignedIn();
    expect(wasSignedIn()).toBe(true);
    await wipeDeviceData();
    expect(wasSignedIn()).toBe(false);
  });
});
