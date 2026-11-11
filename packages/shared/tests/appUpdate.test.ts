import { describe, expect, it } from 'vitest';
import {
  APP_UPDATE_FRESH_AFTER_AWAY_MS,
  decideAppUpdate,
  isFreshReturn,
} from '../src/appUpdate.js';

// When an installed app switches to a new deploy it has downloaded. Getting this wrong either
// leaves testers on old builds (too cautious) or drops a call / loses a code (too eager).

describe('decideAppUpdate', () => {
  it('reloads straight away when nothing has been touched since opening or coming back', () => {
    expect(decideAppUpdate({ held: false, untouched: true, hasTypedText: false })).toBe('reload');
  });

  it('offers instead once the person is using the app', () => {
    expect(decideAppUpdate({ held: false, untouched: false, hasTypedText: false })).toBe('offer');
  });

  it('offers instead when text is typed into a field, even if untouched since coming back', () => {
    expect(decideAppUpdate({ held: false, untouched: true, hasTypedText: true })).toBe('offer');
  });

  it('never reloads or offers while a screen holds it (live call, code step)', () => {
    expect(decideAppUpdate({ held: true, untouched: true, hasTypedText: false })).toBe('wait');
    expect(decideAppUpdate({ held: true, untouched: false, hasTypedText: true })).toBe('wait');
  });
});

describe('isFreshReturn', () => {
  it('treats a quick app switch as still in the middle of something', () => {
    expect(isFreshReturn(5_000)).toBe(false);
    expect(isFreshReturn(APP_UPDATE_FRESH_AFTER_AWAY_MS - 1)).toBe(false);
  });

  it('treats a minute or more away as a fresh start', () => {
    expect(isFreshReturn(APP_UPDATE_FRESH_AFTER_AWAY_MS)).toBe(true);
    expect(isFreshReturn(60 * 60_000)).toBe(true);
  });
});
