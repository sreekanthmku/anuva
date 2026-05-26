export type AssessmentViewMode = 'single' | 'paired';

/** Set to `single` to restore one question per screen. */
export const ASSESSMENT_VIEW_MODE: AssessmentViewMode = 'paired';

export function assessmentPath(): '/assessment' | '/assessment-paired' {
  return ASSESSMENT_VIEW_MODE === 'paired' ? '/assessment-paired' : '/assessment';
}
