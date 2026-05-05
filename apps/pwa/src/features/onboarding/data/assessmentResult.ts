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

export const nextSteps: [string, string][] = [
  ['Meet ANU', 'Your personal wellness companion'],
  ['7 days of tracking', 'Build a personalised benchmark'],
  ['Weekly report', 'Clinical insight in plain language'],
  ['Care path', 'Matched specialist · free first consult'],
];
