import { FamilyError } from './errors.js';

/** Origin of the family PWA, used to build the magic link she shares. */
export const FAMILY_PWA_BASE_URL = (
  process.env.FAMILY_PWA_BASE_URL || 'http://localhost:5175'
).replace(/\/$/, '');

export const FAMILY_INVITE_TTL_DAYS = Number(process.env.FAMILY_INVITE_TTL_DAYS || 7);

/**
 * How long a share buys before the gate re-opens. The product rule is "come back in 5–10 minutes",
 * and the default sits in the middle of it.
 */
export const FAMILY_REPROMPT_MINUTES = Number(process.env.FAMILY_REPROMPT_MINUTES || 7);

export const FAMILY_SESSION_TTL_DAYS = Number(process.env.FAMILY_SESSION_TTL_DAYS || 90);

export const FAMILY_SESSION_COOKIE_NAME =
  process.env.FAMILY_SESSION_COOKIE_NAME || 'anuva_family_session';

/**
 * Stamped onto every invite. Bump it whenever the gate's wording about what family members can see
 * changes materially — the stored value is the record of what she actually agreed to.
 */
export const FAMILY_CONSENT_VERSION = '2026-08-27.1';

/**
 * Signs invite tokens. Kept out of the database entirely: an invite token is derived from its row
 * id plus this secret, so a database dump on its own yields no usable link (see tokens.ts).
 *
 * Rotating it invalidates every outstanding invite, which is the intended emergency lever.
 */
export function familyInviteSecret(): string {
  const secret = process.env.FAMILY_INVITE_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new FamilyError(
      503,
      'family_not_configured',
      'Family sharing is not configured on the server.',
    );
  }
  return secret;
}
