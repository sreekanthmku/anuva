/** Dummy caregiver companion data — wire to APIs later. */

export const caregiver = {
  firstName: 'Wilfred',
  initials: 'WM',
} as const;

export const todayContent = {
  eyebrow: 'Her wellness today',
  greeting: `Good morning, ${caregiver.firstName}`,
  dateLine: 'Tuesday, 19 August',
  status: {
    label: 'Overall status',
    headline: 'She may need support',
    body: 'Sleep was low last night, but her mood is steady today.',
  },
  support: {
    label: 'How you can support her',
    headline: 'Send her a thoughtful message',
    body: 'A small gesture may help after a difficult night’s sleep.',
    cta: 'Choose a supportive action',
    completedCta: '✓ Support action completed',
  },
  metricsLabel: 'This week · shared with you',
  metrics: [
    { label: 'Sleep ↓', value: 'Lower today' },
    { label: 'Mood →', value: 'More stable' },
    { label: 'Stress ↑', value: 'Higher' },
    { label: 'Energy ↑', value: 'Improving' },
  ],
  education: {
    label: 'Understand her experience',
    headline: 'Poor sleep can affect energy and patience',
    body: 'Hormonal changes may interrupt sleep and make the following day harder.',
  },
  progress: {
    label: 'Positive progress',
    headline: '11 of 14 tracking days',
    body: 'Her stress trend is beginning to move downward.',
  },
  upcoming: {
    label: 'Upcoming care',
    headline: 'Nutrition consultation',
    body: 'Thursday, 21 August · 4:30 PM',
  },
} as const;

export const learnContent = {
  eyebrow: 'Family learning',
  title: 'Know what she’s going through',
  subline: 'Two supportive nudges each week',
  nudge: {
    label: 'This week’s nudge',
    headline: 'Mood changes aren’t always personal',
    body: 'Hormonal fluctuations can affect emotional regulation.',
  },
  tip: {
    label: 'Communication tip',
    headline: 'Listen before trying to solve',
    body: 'Ask: “Would you like me to listen, help, or give you space?”',
  },
  topicsLabel: 'Explore topics',
  topics: [
    'Perimenopause and hormones',
    'Sleep and low energy',
    'Brain fog and mood',
    'Hot flashes and stress',
  ],
} as const;

export const privacyContent = {
  eyebrow: 'Privacy & consent',
  title: 'She stays in control',
  subline: 'Only information she chooses is shared.',
  sharedLabel: 'Currently shared',
  shared: ['Mood and stress trends ✓', 'Sleep and energy ✓', 'Upcoming care ✓'],
  privateLabel: 'Private by default',
  privateItems: [
    'Medical records and notes',
    'Prescriptions',
    'Private ANU conversations',
    'Sensitive symptoms',
  ],
} as const;

export const supportActions = [
  { id: 'message', label: 'Message her' },
  { id: 'call', label: 'Call her' },
  { id: 'flowers', label: 'Send flowers' },
  { id: 'chocolates', label: 'Send chocolates' },
] as const;

export type SupportActionId = (typeof supportActions)[number]['id'];

export const supportSheet = {
  label: 'Take a supportive action',
  headline: 'What would you like to do today?',
  done: 'Done',
  remindLater: 'Remind me later',
  toastDone: '✓ You supported her today. Action recorded.',
  toastRemind: 'Reminder saved for this evening.',
} as const;
