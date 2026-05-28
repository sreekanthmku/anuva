export type RiskPill = {
  title: string;
  value: string;
  color: string;
};

export const riskPills: RiskPill[] = [
  { title: 'Vasomotor', value: 'High', color: '#F87171' },
  { title: 'Sleep', value: 'Moderate', color: '#e2c62d' },
  { title: 'Cognitive', value: 'Low', color: '#cebdff' },
];

export const controlPills: RiskPill[] = [
  { title: 'Score', value: 'In control', color: '#cebdff' },
  { title: 'Follow-up', value: '3 months', color: '#60A5FA' },
  { title: 'Status', value: 'Stable', color: '#e2c62d' },
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
