/**
 * How a note reaches her, and — more importantly — where it must not end up.
 *
 * The whole design rests on the note travelling in a URL *fragment*: fragments are not sent to the
 * server, so the note stays out of access logs. If someone ever "tidies" this into a query
 * parameter, these tests are what should stop them.
 */

import { describe, expect, it } from 'vitest';

const { readFamilyMessageFromHash } = await import(
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
