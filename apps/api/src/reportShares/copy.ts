import { copy } from '../i18n/index.js';

export const REPORT_SHARE_TEXT = copy('reportShares.errors', {
  consultationNotFound: 'Consultation not found.',
  reportNotFound: 'Report not found.',
  shareConsentOutdated: 'The sharing notice has changed. Please read it again.',
  consultationClosed: 'Reports can only be shared before or during a consultation.',
  notAvailable: 'One of those reports is no longer available to share. Please try again.',
});
