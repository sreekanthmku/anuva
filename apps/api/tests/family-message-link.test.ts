/**
 * How a note reaches her, and — more importantly — where it must not end up.
 *
 * The whole design rests on the note travelling in a URL *fragment*: fragments are not sent to the
 * server, so the note stays out of access logs. If someone ever "tidies" this into a query
 * parameter, these tests are what should stop them.
 */

import { describe, expect, it } from 'vitest';

const { readFamilyMessageFromHash, readFamilyGiftFromHash } = await import(
  '../../pwa/src/features/family/familyMessageLink.js'
).catch(() => import('../../pwa/src/features/family/familyMessageLink.ts' as string));

describe('family message deep link', () => {
  it('reads the note and sender out of a fragment', () => {
    const hash = `#familyMessage=${encodeURIComponent('Thinking of you today.')}&familyFrom=Wilfred`;
    expect(readFamilyMessageFromHash(hash)).toEqual({
      text: 'Thinking of you today.',
      from: 'Wilfred',
    });
  });

  it('survives the characters people actually type', () => {
    const text = 'Hope today is gentler ❤️ — call me? 50% better, right?';
    const hash = `#familyMessage=${encodeURIComponent(text)}&familyFrom=A`;
    expect(readFamilyMessageFromHash(hash)?.text).toBe(text);
  });

  it('falls back to a neutral sender rather than showing nothing', () => {
    expect(readFamilyMessageFromHash('#familyMessage=hi')?.from).toBe('Your family');
  });

  it('is null when there is no note', () => {
    for (const hash of ['', '#', '#nudge=morning', '#familyFrom=Wilfred']) {
      expect(readFamilyMessageFromHash(hash)).toBeNull();
    }
  });
});

describe('family gift deep link', () => {
  it('reads the gift kind and sender out of a fragment', () => {
    expect(readFamilyGiftFromHash('#familyGift=flowers&familyFrom=Wilfred')).toEqual({
      kind: 'flowers',
      from: 'Wilfred',
    });
    expect(readFamilyGiftFromHash('#familyGift=chocolates&familyFrom=A')?.kind).toBe('chocolates');
  });

  it('falls back to a neutral sender', () => {
    expect(readFamilyGiftFromHash('#familyGift=flowers')?.from).toBe('Your family');
  });

  // A newer sender talking to an older app must show nothing rather than a card with no picture.
  it('is null for an unknown or missing kind', () => {
    for (const hash of ['', '#', '#familyGift=', '#familyGift=puppies', '#familyMessage=hi']) {
      expect(readFamilyGiftFromHash(hash)).toBeNull();
    }
  });

  // The two live in the same fragment slot and must never both fire.
  it('does not confuse a note for a gift', () => {
    const hash = '#familyMessage=hello&familyFrom=Wilfred';
    expect(readFamilyGiftFromHash(hash)).toBeNull();
    expect(readFamilyMessageFromHash('#familyGift=flowers&familyFrom=Wilfred')).toBeNull();
  });
});
