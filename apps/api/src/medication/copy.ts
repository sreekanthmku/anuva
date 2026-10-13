import { copy } from '../i18n/index.js';

/**
 * What a medication reminder says. It never names anything — there is no name to name, and a lock
 * screen is not private — only whether it is a medication or a supplement, when she said which.
 */
export const MEDICATION_PUSH = copy('push.medication', {
  title: {
    medication: 'Time for your medication',
    supplement: 'Time for your supplement',
    none: 'Time for your reminder',
  },
  body: 'Tap to mark it taken, or snooze it for 15 minutes.',
  followUpTitle: {
    medication: 'Your medication reminder',
    supplement: 'Your supplement reminder',
    none: 'Your reminder',
  },
  followUpBody: 'Just checking in — tap to mark it taken, snooze it or skip it.',
});

export const MEDICATION_TEXT = copy('medication.errors', {
  reminderNotFound: 'Reminder not found.',
  doseNotFound: 'Reminder not found.',
  invalidTimeZone: 'Your phone’s time zone was not recognised.',
  tooMany: 'You can have up to {{count}} reminders.',
  earlierDay: 'This reminder was for an earlier day.',
  snoozeAnswered: 'This reminder has already been answered.',
});

export function kindKey(kind: string | null): 'medication' | 'supplement' | 'none' {
  return kind === 'medication' || kind === 'supplement' ? kind : 'none';
}
