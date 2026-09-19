import { copy, plural } from './i18n/index.js';

/**
 * Patient-facing pushes sent from someone else's request (a doctor's). Worded warmly, because they
 * land on her phone right after a consultation; localised into *her* stored language at send time.
 */
export const PATIENT_PUSH = copy('push.patient', {
  callReady: {
    title: 'Doctor is ready',
    body: '{{doctor}} has started your consultation call.',
  },
  documents: {
    prescription: {
      title: 'Your prescription is ready 💜',
      body: '{{doctor}} has shared your prescription. Tap to view it whenever you’re ready.',
    },
    diet_plan: {
      title: 'Your diet plan is here 🌿',
      body: '{{doctor}} has shared your diet plan. Have a look when you have a moment.',
    },
    care_plan: {
      title: 'Your care plan is ready 💜',
      body: '{{doctor}} has shared your care plan. Tap to view it whenever you’re ready.',
    },
    suggestion: {
      title: 'A suggestion from your consultation',
      body: '{{doctor}} has shared a suggestion with you. Have a look when you have a moment.',
    },
  },
});

export const PATIENT_TEXT = copy('patient.text', {
  bookingComingSoon: 'Booking for this specialist is coming soon.',
});

/**
 * English for the index.ts errors that carry a value. They are thrown with `{ key, vars }` and the
 * error handler looks the key up; registering them here puts them in the extracted `en.json`.
 */
copy('errors', {
  dayInsidePeriod:
    'That day falls inside your period starting {{date}}. Change that period’s dates instead.',
  datesOverlapPeriod: 'Those dates overlap your period starting {{date}}.',
  uploadRejected: 'Upload rejected: {{reason}}',
});
plural('errors.questionsDailyLimit', {
  one: 'You can ask up to {{count}} question a day. Please come back tomorrow.',
  other: 'You can ask up to {{count}} questions a day. Please come back tomorrow.',
});
plural('errors.ticketsDailyLimit', {
  one: 'You can open up to {{count}} request a day. We are already looking at the ones you sent.',
  other: 'You can open up to {{count}} requests a day. We are already looking at the ones you sent.',
});
plural('errors.exportCooldown', {
  one: 'You can download your data once every {{count}} hour. Please try again later.',
  other: 'You can download your data once every {{count}} hours. Please try again later.',
});
