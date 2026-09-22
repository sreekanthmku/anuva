import { describe, expect, it } from 'vitest';
import { parsePending } from '../src/lib/pwa/pendingNavigation';

const NOW = 1_700_000_000_000;
const stored = (url: string, at = NOW) => JSON.stringify({ url, at });

describe('parsePending', () => {
  it('returns a destination stored moments ago', () => {
    expect(parsePending(stored('/#familyThanks=message&familyThanksFrom=Meera'), NOW + 1_000)).toBe(
      '/#familyThanks=message&familyThanksFrom=Meera',
    );
  });

  it('ignores a tap from an earlier sitting', () => {
    // Waking the app hours later must not reopen a card for a notification long since read.
    expect(parsePending(stored('/#familyThanks=message'), NOW + 3 * 60 * 60 * 1000)).toBeNull();
  });

  it('accepts one just inside the window and rejects one just outside', () => {
    expect(parsePending(stored('/learn'), NOW + 119_000)).toBe('/learn');
    expect(parsePending(stored('/learn'), NOW + 121_000)).toBeNull();
  });

  it('refuses anything that is not a same-origin path', () => {
    // A destination is only ever a path the router can navigate to.
    expect(parsePending(stored('https://example.com/phish'), NOW)).toBeNull();
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
