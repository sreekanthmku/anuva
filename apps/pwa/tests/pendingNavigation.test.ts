import { beforeEach, describe, expect, it } from 'vitest';
import {
  alreadyHandled,
  markNavigationHandled,
  parsePending,
} from '../src/lib/pwa/pendingNavigation';

const NOW = 1_700_000_000_000;
const stored = (url: string, at = NOW) => JSON.stringify({ url, at });

describe('parsePending', () => {
  it('returns a destination stored moments ago', () => {
    expect(parsePending(stored('/home#familyMessage=Hello'), NOW + 1_000)).toBe(
      '/home#familyMessage=Hello',
    );
  });

  it('ignores a tap from an earlier sitting', () => {
    // Waking the app hours later must not reopen a card for a notification long since read.
    expect(parsePending(stored('/home#familyMessage=Hello'), NOW + 3 * 60 * 60 * 1000)).toBeNull();
  });

  it('accepts one just inside the window and rejects one just outside', () => {
    expect(parsePending(stored('/learn'), NOW + 119_000)).toBe('/learn');
    expect(parsePending(stored('/learn'), NOW + 121_000)).toBeNull();
  });

  it('refuses anything that is not a same-origin path', () => {
    expect(parsePending(stored('https://example.com/phish'), NOW)).toBeNull();
    // Protocol-relative: starts with a slash, but navigates off-site.
    expect(parsePending(stored('//example.com'), NOW)).toBeNull();
    expect(parsePending(JSON.stringify({ url: 42, at: NOW }), NOW)).toBeNull();
  });

  it('survives junk in storage', () => {
    expect(parsePending(null)).toBeNull();
    expect(parsePending('')).toBeNull();
    expect(parsePending('not json')).toBeNull();
    expect(parsePending(JSON.stringify({ url: '/ok' }), NOW)).toBeNull();
  });
});

/**
 * The bug this guards: tapping a notification navigated to the same deep link twice — once from the
 * posted message and once from the stored copy — because clearing the store is asynchronous and the
 * read could win the race. The second navigation re-added the `#familyMessage=…` fragment and
 * re-opened the card. If it landed after she had tapped "thank you", the card she had just
 * dismissed reappeared and the button looked broken.
 */
describe('one tap, one navigation', () => {
  const LINK = '/home#familyMessage=Thinking%20of%20you&familyFrom=Wilfred';

  beforeEach(() => {
    // Module state persists between tests, so start each one with nothing claimed.
    markNavigationHandled('');
  });

  it('treats a destination as taken once a route has claimed it', () => {
    expect(alreadyHandled(LINK)).toBe(false);
    markNavigationHandled(LINK);
    expect(alreadyHandled(LINK)).toBe(true);
  });

  it('does not confuse a different destination for a claimed one', () => {
    markNavigationHandled(LINK);
    expect(alreadyHandled('/home#familyGift=flowers&familyFrom=Wilfred')).toBe(false);
  });

  it('lets a genuinely new notification to the same place through, much later', () => {
    // Otherwise a second note from the same person would never open its card.
    markNavigationHandled(LINK);
    expect(alreadyHandled(LINK, Date.now() + 61_000)).toBe(false);
  });

  it('claims nothing when no route has run', () => {
    expect(alreadyHandled('/home')).toBe(false);
  });
});
