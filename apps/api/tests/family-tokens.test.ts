/**
 * Invite tokens are derived from the row id plus FAMILY_INVITE_SECRET rather than stored, so the
 * link is reconstructible for as long as it is valid and a database dump alone yields nothing
 * usable. These tests pin the two halves of that: the round trip, and that a tampered token fails.
 *
 * Env is set before the dynamic import because config.ts reads FAMILY_PWA_BASE_URL at module load.
 */

import { describe, expect, it } from 'vitest';

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';
process.env.FAMILY_PWA_BASE_URL = 'https://family.test/';

const { buildShareMessage, buildShareUrl, inviteTokenHash, mintInviteToken, parseInviteToken } =
  await import('../src/family/tokens.js');

const INVITE_ID = 'cltest0000000000000000001';

describe('invite tokens', () => {
  it('round-trips an invite id', () => {
    expect(parseInviteToken(mintInviteToken(INVITE_ID))).toBe(INVITE_ID);
  });

  it('is deterministic, so the same link can be shown again later', () => {
    expect(mintInviteToken(INVITE_ID)).toBe(mintInviteToken(INVITE_ID));
  });

  it('gives different invites different tokens', () => {
    expect(mintInviteToken(INVITE_ID)).not.toBe(mintInviteToken(`${INVITE_ID}2`));
  });

  it('rejects a tampered signature', () => {
    const token = mintInviteToken(INVITE_ID);
    expect(parseInviteToken(`${token.slice(0, -2)}xy`)).toBeNull();
  });

  it('rejects a swapped id under a valid signature', () => {
    const [, signature] = mintInviteToken(INVITE_ID).split('.');
    expect(parseInviteToken(`someoneelse.${signature}`)).toBeNull();
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on a length mismatch, so the length check has to come first.
    expect(() => parseInviteToken(`${INVITE_ID}.short`)).not.toThrow();
    expect(parseInviteToken(`${INVITE_ID}.short`)).toBeNull();
  });

  it('rejects malformed input', () => {
    for (const bad of ['', '.', 'nodot', `.${'x'.repeat(43)}`, `${INVITE_ID}.`]) {
      expect(parseInviteToken(bad)).toBeNull();
    }
  });

  it('hashes to something that is not the token', () => {
    const token = mintInviteToken(INVITE_ID);
    const hash = inviteTokenHash(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('puts the token in the fragment, never the path or query', () => {
    const url = buildShareUrl(mintInviteToken(INVITE_ID));
    // Everything before '#' is what reaches a server log or a Referer header.
    const [addressable, fragment] = url.split('#');
    expect(addressable).toBe('https://family.test/join');
    expect(fragment).toBe(`t=${mintInviteToken(INVITE_ID)}`);
  });

  it('builds a share message carrying her first name and the link', () => {
    const url = buildShareUrl(mintInviteToken(INVITE_ID));
    const message = buildShareMessage('Meera', url);
    expect(message.startsWith('Meera')).toBe(true);
    expect(message).toContain(url);
  });

  it('falls back to first person when her name is unknown', () => {
    const message = buildShareMessage(null, 'https://family.test/join#t=x');
    expect(message.startsWith('I have started')).toBe(true);
  });
});
