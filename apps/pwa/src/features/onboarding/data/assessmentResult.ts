export type RiskPill = {
  title: string;
  value: string;
  color: string;
};

export const riskPills: RiskPill[] = [
  { title: 'Vasomotor', value: 'High', color: '#C0405A' },
  { title: 'Sleep', value: 'Moderate', color: '#C97E92' },
  { title: 'Cognitive', value: 'Low', color: '#5E3566' },
];

export const controlPills: RiskPill[] = [
  { title: 'Score', value: 'In control', color: '#5E3566' },
  { title: 'Follow-up', value: '3 months', color: '#5B82C4' },
  { title: 'Status', value: 'Stable', color: '#C97E92' },
];

export const nextSteps: [string, string][] = [
  ['Meet ANU', 'Your personal wellness companion'],
  ['14 days of tracking', 'Build a personalised benchmark'],
  ['Weekly report', 'Clinical insight in plain language'],
  ['Care path', 'Matched specialist · free first consult'],
];

export const controlNextSteps: [string, string][] = [
  ['Everything is in control', 'No urgent follow-up is needed right now'],
  ['Check back after 3 months', 'Reassess if symptoms change or intensify'],
  ['Keep tracking lightly', 'Stay in tune with your body and cycles'],
];
