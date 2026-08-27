import crypto from 'node:crypto';
import { FAMILY_PWA_BASE_URL, familyInviteSecret } from './config.js';

/**
 * Invite tokens are *derived*, not stored.
 *
 * A token is `<inviteId>.<HMAC-SHA256(secret, inviteId)>`. That buys three things a stored random
 * token could not have all at once:
 *
 *   1. Nothing secret sits in the database. `FamilyInvite.tokenHash` holds sha256 of the token, which
 *      is a lookup key and not a credential; without FAMILY_INVITE_SECRET a database dump cannot
 *      produce a working link.
 *   2. The link is reconstructible. She has to be shown the same URL every time the gate opens — on
 *      a new device, weeks later — and a one-way hash of a random token could not give it back
 *      without either storing the token or rotating the link and killing one already in flight.
 *   3. Rotating the secret invalidates every outstanding invite at once.
 *
 * The token travels in the URL *fragment* (`#t=`), so it never reaches a server log, a Referer
 * header, or a CDN access log.
 */

function signature(inviteId: string): string {
  return crypto.createHmac('sha256', familyInviteSecret()).update(inviteId).digest('base64url');
}

export function mintInviteToken(inviteId: string): string {
  return `${inviteId}.${signature(inviteId)}`;
}

export function inviteTokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * The inverse: recover the invite id a token refers to, or null if the signature does not hold.
 * Compared in constant time, and only after a length check — `timingSafeEqual` throws on a length
 * mismatch rather than returning false.
 */
export function parseInviteToken(token: string): string | null {
  const separator = token.lastIndexOf('.');
  if (separator <= 0 || separator === token.length - 1) {
    return null;
  }

  const inviteId = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1));
  const expected = Buffer.from(signature(inviteId));

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  return inviteId;
}

export function buildShareUrl(token: string): string {
  return `${FAMILY_PWA_BASE_URL}/join#t=${token}`;
}

/**
 * The message body for WhatsApp and the native share sheet. It carries the URL, so the client sends
 * one string; `shareUrl` is served alongside it for the copy-link path.
 */
export function buildShareMessage(firstName: string | null, shareUrl: string): string {
  const name = firstName?.trim() || 'I';
  const opener =
    name === 'I'
      ? 'I have started using Anuva to understand what my body is going through.'
      : `${name} here — I have started using Anuva to understand what my body is going through.`;

  return [
    opener,
    'This link lets you see how I am doing and how you can help. It only works for you, and it expires.',
    shareUrl,
  ].join('\n\n');
}
