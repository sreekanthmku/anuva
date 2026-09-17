/**
 * The result screen's fixed furniture: which pills appear, in what order, and what colour each one
 * carries. The words are resolved through `assessmentResult.*` at render — a pill is identified by
 * its key, not by the English it used to be spelled with.
 */

export type RiskPill = {
  /** `assessmentResult.pills.<titleKey>` — the label above the value. */
  titleKey: string;
  /** `assessmentResult.values.<valueKey>` — the value itself. */
  valueKey: string;
  color: string;
};

export const riskPills: RiskPill[] = [
  { titleKey: 'vasomotor', valueKey: 'high', color: '#C0405A' },
  { titleKey: 'sleep', valueKey: 'moderate', color: '#5B82C4' },
  { titleKey: 'cognitive', valueKey: 'low', color: '#5E3566' },
];

export const controlPills: RiskPill[] = [
  { titleKey: 'score', valueKey: 'inControl', color: '#5E3566' },
  { titleKey: 'followUp', valueKey: 'threeMonths', color: '#5B82C4' },
  { titleKey: 'status', valueKey: 'stable', color: '#4F9D6B' },
];

/** `assessmentResult.steps.<key>.title` / `.body`. */
export const nextSteps: string[] = ['meetAnu', 'tracking', 'weeklyReport', 'carePath'];

export const controlNextSteps: string[] = ['allInControl', 'checkBack', 'keepTracking'];
