import { describe, expect, it } from 'vitest';
import { readThanksFromHash } from '../src/features/notifications/thanksLink';

/** The link exactly as the API builds it in `apps/api/src/family/thanks.ts`. */
function serverLink(kind: string, from: string, body: string): string {
  const fragment = new URLSearchParams({ familyThanks: kind, familyThanksFrom: from, familyThanksBody: body });
  return `/#${fragment.toString()}`;
}

const hashOf = (url: string) => url.slice(url.indexOf('#'));

describe('readThanksFromHash', () => {
  it('reads back exactly what the server put in the link', () => {
    const url = serverLink('message', 'Meera', 'She opened your note and it landed. 💛');
    expect(readThanksFromHash(hashOf(url))).toEqual({
      from: 'Meera',
      body: 'She opened your note and it landed. 💛',
    });
  });

  it('round-trips a thank-you in the family member’s own script', () => {
    const body = 'उन्होंने आपका नोट खोला और यह दिल तक पहुँचा। 💛';
    const url = serverLink('call', 'मीरा', body);
    expect(readThanksFromHash(hashOf(url))).toEqual({ from: 'मीरा', body });
  });

  it('ignores a fragment that is not a thank-you', () => {
    expect(readThanksFromHash('')).toBeNull();
    expect(readThanksFromHash('#')).toBeNull();
    // The join link also carries its token in the fragment — it must not open a thank-you card.
    expect(readThanksFromHash('#token=abc123')).toBeNull();
  });

  it('still opens the card when the name or words are missing', () => {
    const result = readThanksFromHash('#familyThanks=general');
    expect(result).not.toBeNull();
    expect(result!.from.length).toBeGreaterThan(0);
    expect(result!.body.length).toBeGreaterThan(0);
  });
});
