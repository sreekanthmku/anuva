import { copy, t, translateMessage, type Vars } from '../i18n/index.js';

/**
 * Every message the family module rejects a request with, registered as English copy so the router
 * can answer in the member's language. The throw sites keep their English literals — these entries
 * are how those literals are recognised — so a message changed at a throw site must be changed here
 * too, or it simply goes out in English.
 */
copy('errors.family', {
  linkNotValid: 'This link is not valid.',
  linkNoLongerActive: 'This link is no longer active.',
  linkClaimed: 'Someone has already joined with this link.',
  linkExpired: 'This link has expired. Ask her for a new one.',
  tooManyCodes: 'Too many codes requested. Try again in a few minutes.',
  codeRequestNotFound: 'That code request could not be found.',
  codeUsed: 'That code has already been used. Ask for a new one.',
  codeExpired: 'That code has expired. Ask for a new one.',
  tooManyIncorrectCodes: 'Too many incorrect codes. Ask for a new one.',
  noMembership:
    'We could not find an active connection for this number. Ask her to send you a new invite link.',
  accountUnavailable: 'This account is no longer available.',
  inviteGone: 'That invite no longer exists.',
  inviteStale: 'That link is no longer valid. Get a new one.',
  memberNotConnected: 'That family member is not connected.',
  periodConsentOutdated: 'The wording about sharing your period has changed. Please read it again.',
  emergencyConsentOutdated: 'The wording about emergency alerts has changed. Please read it again.',
  coreConsentRequired: 'Agree to what they will see before you send the link.',
  coreConsentOutdated: 'What family members see has changed. Please read it again.',
  linkNotReady: 'This link is not ready yet. Ask her to send it again.',
  nothingToConfirm: 'Nothing is waiting to be confirmed.',
  thanksRateLimited: 'That is plenty of thank-yous for now. Try again in a little while.',
  messagesRateLimited: 'You have sent a few messages already. Give it an hour before the next one.',
  tooManyAttempts: 'Too many attempts. Try again in a minute.',
  articleUnavailable: 'That article is not available.',
  notSignedIn: 'You are not signed in.',
  sessionExpired: 'Your session has expired. Open your invite link again.',
  accessRevoked: 'You no longer have access to this.',
  sharingStopped: 'Sharing has been turned off.',
  requestNotCompleted: 'Request could not be completed.',
  somethingWentWrong: 'Something went wrong. Please try again.',
  codeCooldown_one: 'Please wait {{count}} second before asking for another code.',
  codeCooldown_other: 'Please wait {{count}} seconds before asking for another code.',
});

/** Raised by the family module. Mirrors Report14Error: the router turns it into its status. */
export class FamilyError extends Error {
  status: number;
  code: string;
  /** For a message with a value in it: the key and values to localise it with. */
  i18n?: { key: string; vars?: Vars };

  constructor(status: number, code: string, message: string, i18n?: { key: string; vars?: Vars }) {
    super(message);
    this.name = 'FamilyError';
    this.status = status;
    this.code = code;
    this.i18n = i18n;
  }

  /** The response text in the request's language; English when there is no translation. */
  localized(): string {
    return this.i18n
      ? t(this.i18n.key, this.i18n.vars, { fallback: this.message })
      : translateMessage(this.message);
  }
}
