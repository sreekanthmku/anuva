import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  alreadyHandled,
  markNavigationHandled,
  takePendingNavigation,
} from '../src/lib/pwa/pendingNavigation';

/** The real race: the posted message and the stored copy both arrive at resume. */
describe('the resume race', () => {
  const LINK = '/#familyThanks=message&familyThanksFrom=Meera';
  const navigate = vi.fn();

  beforeEach(() => {
    navigate.mockReset();
    markNavigationHandled('');
    // Cache Storage still holding the destination the service worker wrote.
    (globalThis as { caches?: unknown }).caches = {
      open: async () => ({
        match: async () => ({ text: async () => JSON.stringify({ url: LINK, at: Date.now() }) }),
        delete: async () => true,
      }),
    };
  });

  /** What the message listener does. */
  function onPostedMessage(url: string) {
    if (alreadyHandled(url)) return;
    markNavigationHandled(url);
    navigate(url);
  }

  /** What the resume collector does. */
  async function onResume() {
    const url = await takePendingNavigation();
    if (url) navigate(url);
  }

  it('navigates once when the message wins', async () => {
    onPostedMessage(LINK);
    await onResume();
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates once when the stored copy wins', async () => {
    await onResume();
    onPostedMessage(LINK);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('navigates once when both fire together', async () => {
    const resume = onResume();
    onPostedMessage(LINK);
    await resume;
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
