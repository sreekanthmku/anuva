import { copy, plural } from '../i18n/index.js';

/**
 * Words are neutral on purpose — "Periods logged", not "Your periods" — because the same rendering
 * is read by her while she reviews it and by the doctor once she has shared it.
 */
export const SUMMARY_TEXT = copy('visitSummary', {
  sections: {
    profile: 'Profile',
    cycle: 'Periods',
    wellbeing: 'Daily check-ins',
    body: 'Body',
    medication: 'Medication reminders',
    concerns: 'Concerns raised with Anu',
    lastVisit: 'Last visit',
  },
  empty: {
    profile: 'No profile details recorded.',
    cycle: 'No periods logged in this time.',
    wellbeing: 'No daily check-ins logged in this time.',
    body: 'No body symptoms logged in this time.',
    medication: 'No medication reminders set up.',
    concerns: 'Anu did not flag anything that needed a doctor in this time.',
    lastVisit: 'This is the first consultation on Anuva Wellness.',
  },
  window: {
    since: 'Since the visit with {{name}} on {{date}}',
    sinceDate: 'Since {{date}}',
    fallback: 'The last {{days}} days',
  },
  profile: {
    age: 'Age',
    ageValue: '{{age}} years',
    stage: 'Stage',
    assessment: 'Assessment score',
    assessmentValue: '{{score}} (threshold {{threshold}})',
    assessmentTaken: 'Taken {{date}}',
  },
  stages: {
    premenopause: 'Premenopause',
    perimenopause: 'Perimenopause',
    menopause: 'Menopause',
    postmenopause: 'Postmenopause',
  },
  assessmentStatus: {
    in_control: 'Symptoms in control',
    further_assessment: 'Further assessment suggested',
  },
  cycle: {
    count: 'Periods logged',
    lastStart: 'Last period started',
    cycleLength: 'Cycle length',
    cycleRange: '{{min}}–{{max}} days',
    usual: 'Usual: {{days}} days',
    started: 'Started {{date}}',
    ongoing: 'Ongoing',
    estimated: 'About {{days}} days (end estimated)',
  },
  wellbeing: {
    hotFlashEstimate: 'Hot flashes, estimated',
    hotFlashValue: 'About {{count}}',
    nightSweats: 'Night sweats',
    mostOften: 'Most often: {{answers}}',
    better: 'Better in the second half',
    worse: 'Worse in the second half',
    steady: 'About the same throughout',
    notScored: 'Logged',
  },
  metrics: {
    sleep: 'Sleep',
    energy: 'Energy',
    stress: 'Stress',
    mood: 'Mood',
    focus: 'Focus',
    hotFlashes: 'Heat episodes',
  },
  body: {
    joints: 'Joints & stiffness',
    jointsSeverity: 'Severe {{severe}} · Moderate {{moderate}} · Mild {{mild}}',
    jointsAreas: 'Mostly: {{areas}}',
    pain: 'Pain',
    bloating: 'Bloating',
  },
  quickSymptoms: {
    anxiety: 'Anxiety',
    chills: 'Chills',
    irritability: 'Irritability',
    hot_flash: 'Hot flash',
  },
  medication: {
    reminders: 'Reminders set up',
    doses: 'Doses',
    dosesValue: '{{taken}} taken · {{skipped}} skipped · {{missed}} missed',
    takenShare: '{{percent}}% taken',
  },
  concerns: {
    unlabelled: 'Needed a professional’s review',
    suggested: 'Anu suggested: {{pathway}}',
  },
  levels: {
    L2: 'Worth a professional review',
    L3: 'Prompt medical review',
    L4: 'Urgent',
  },
  pathways: {
    emergency: 'Emergency care',
    gynecologist: 'Gynecologist',
    psychologist: 'Psychologist',
    dietitian: 'Dietitian',
    menopause_coach: 'Menopause coach',
    physiotherapist: 'Physiotherapist',
    general_physician: 'General physician',
  },
  lastVisit: {
    with: 'With',
    date: 'Date',
  },
  documentKinds: {
    prescription: 'Prescription',
    diet_plan: 'Diet plan',
    care_plan: 'Care plan',
    suggestion: 'Suggestion',
  },
});

export const SUMMARY_PLURALS = {
  days: plural('visitSummary.plurals.days', { one: '{{count}} day', other: '{{count}} days' }),
  daysLogged: plural('visitSummary.plurals.daysLogged', {
    one: 'Logged {{count}} day',
    other: 'Logged {{count}} days',
  }),
  hardDays: plural('visitSummary.plurals.hardDays', {
    one: '{{count}} difficult day',
    other: '{{count}} difficult days',
  }),
  daysAgo: plural('visitSummary.plurals.daysAgo', { one: '{{count}} day ago', other: '{{count}} days ago' }),
  nights: plural('visitSummary.plurals.nights', { one: '{{count}} night', other: '{{count}} nights' }),
  times: plural('visitSummary.plurals.times', { one: '{{count}} time', other: '{{count}} times' }),
  heavyDays: plural('visitSummary.plurals.heavyDays', {
    one: '{{count}} heavy day',
    other: '{{count}} heavy days',
  }),
};

export const SUMMARY_ERRORS = copy('visitSummary.errors', {
  consultationNotFound: 'Consultation not found.',
  summaryNotFound: 'Summary not found.',
  consultationClosed: 'A summary can only be shared before the consultation starts.',
  draftExpired: 'This summary is out of date. Please make a fresh one.',
  consentOutdated: 'The sharing notice has changed. Please read it again.',
  cannotRevoke: 'This consultation has started, so the doctor keeps the summary you shared.',
  noteNotFound: 'One of those notes is no longer available.',
  noteNotReady: 'Only saved notes can be shared. Check and save each note first.',
  tooManyNotes: 'Up to {{count}} notes can be shared with one consultation.',
});
