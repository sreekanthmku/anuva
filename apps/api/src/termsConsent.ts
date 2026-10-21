// The Terms of Use and Privacy Policy agreement behind every new account. Kept out of index.ts so
// the rule is testable on its own: an account is created only with the current version, and the
// agreement is written in the same insert as the account, so one never exists without the other.

import { TERMS_CONSENT_VERSION } from '@anuva/shared';

export const TERMS_REQUIRED_MESSAGE =
  'Please accept the latest Terms of Use and Privacy Policy to create an account.';

/** A missing or stale version is not an agreement to the documents as they stand today. */
export function hasAcceptedCurrentTerms(termsVersion: string | undefined): termsVersion is string {
  return termsVersion === TERMS_CONSENT_VERSION;
}

/** Nested `consentRecords` create for `prisma.user.create`. */
export function termsConsentCreate(termsVersion: string) {
  return { create: { purpose: 'terms_and_privacy' as const, textVersion: termsVersion } };
}
