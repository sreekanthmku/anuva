/**
 * Each pre-assessment step is its own browser history entry, so the phone's back gesture steps
 * back through the questions instead of leaving them, exactly like the back chevron does.
 *
 * Every entry carries its step in `history.state`. Entries that Continue pushed are marked, because
 * only for those is the entry underneath known to be the step before. An entry she arrived on
 * (fresh, after a reload, back from the result page) has nothing of hers underneath, so going back
 * from it rewrites the entry in place rather than popping out of the assessment.
 */

export type AssessmentStepState = {
  assessmentStep: number;
  /** Pushed by Continue: the entry underneath is `assessmentStep - 1`. */
  pushedByNext?: true;
};

/** The step stored on a history entry, or undefined when the entry has none (or a stale one). */
export function readHistoryStep(state: unknown, totalSteps: number): number | undefined {
  if (!state || typeof state !== 'object') return undefined;
  const step = (state as Partial<AssessmentStepState>).assessmentStep;
  return Number.isInteger(step) && step! >= 0 && step! < totalSteps ? step : undefined;
}

/**
 * How far she can be: the first step with an unanswered question. A history entry can outlive her
 * answers (they are cleared once she starts her trial), and a step past a gap would score
 * questions she never saw.
 */
export function furthestReachableStep(totalSteps: number, isStepAnswered: (step: number) => boolean): number {
  for (let step = 0; step < totalSteps - 1; step += 1) {
    if (!isStepAnswered(step)) return step;
  }
  return Math.max(totalSteps - 1, 0);
}

export type BackAction = 'none' | 'pop' | 'replace';

/** What going back from `step` should do to history. */
export function backAction(state: unknown, step: number, totalSteps: number): BackAction {
  if (step <= 0) return 'none';
  const historyStep = readHistoryStep(state, totalSteps);
  const pushed = Boolean(state && typeof state === 'object' && (state as AssessmentStepState).pushedByNext);
  return pushed && historyStep === step ? 'pop' : 'replace';
}
