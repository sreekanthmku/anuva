import type { AssessmentQuestion } from './assessmentQuestions';

/**
 * Her place in the pre-assessment, kept in sessionStorage so leaving the questions does not lose
 * them: going back from the result (Start trial) page, a reload, or the login detour before the
 * trial all land her where she was, with every answer still ticked.
 *
 * Session-scoped on purpose, like the stored result: it is only meant to survive this sitting, and
 * it is cleared once she starts her trial and enters the app.
 *
 * Everything read back is validated against the questions as they are now. A stored answer to a
 * question that has since changed, or a step past the end, is dropped rather than trusted.
 */

export const ASSESSMENT_PROGRESS_KEY = 'anuva-assessment-progress';

export type AssessmentAnswers = Record<number, number | undefined>;

/** `single` steps through questions one by one; `paired` through pages of two. */
export type AssessmentProgressMode = 'single' | 'paired';

export type AssessmentProgress = { step: number; answers: AssessmentAnswers };

type StoredProgress = {
  mode: AssessmentProgressMode;
  step: number;
  /** The question ids, in order, when this was saved. A different list means different questions. */
  questionIds: string[];
  answers: Record<string, number>;
};

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** sessionStorage, or null where it is blocked (private mode, some in-app browsers). */
export function sessionStore(): ProgressStorage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

const EMPTY: AssessmentProgress = { step: 0, answers: {} };

export function readAssessmentProgress(
  storage: ProgressStorage | null,
  mode: AssessmentProgressMode,
  questions: readonly AssessmentQuestion[],
  totalSteps: number,
): AssessmentProgress {
  if (!storage) return EMPTY;
  let stored: StoredProgress;
  try {
    const raw = storage.getItem(ASSESSMENT_PROGRESS_KEY);
    if (!raw) return EMPTY;
    stored = JSON.parse(raw) as StoredProgress;
  } catch {
    return EMPTY;
  }

  const ids = questions.map((question) => question.id);
  if (!Array.isArray(stored?.questionIds) || stored.questionIds.join('|') !== ids.join('|')) return EMPTY;

  const answers: AssessmentAnswers = {};
  for (const [key, value] of Object.entries(stored.answers ?? {})) {
    const index = Number(key);
    const question = questions[index];
    if (question && Number.isInteger(value) && value >= 0 && value < question.options.length) {
      answers[index] = value;
    }
  }

  // The step only means something in the layout it was saved from; the answers carry over either way.
  const step =
    stored.mode === mode && Number.isInteger(stored.step) && stored.step >= 0 && stored.step < totalSteps
      ? stored.step
      : 0;

  return { step, answers };
}

export function writeAssessmentProgress(
  storage: ProgressStorage | null,
  mode: AssessmentProgressMode,
  questions: readonly AssessmentQuestion[],
  progress: AssessmentProgress,
): void {
  if (!storage) return;
  const answers: Record<string, number> = {};
  for (const [key, value] of Object.entries(progress.answers)) {
    if (value !== undefined) answers[key] = value;
  }
  const stored: StoredProgress = {
    mode,
    step: progress.step,
    questionIds: questions.map((question) => question.id),
    answers,
  };
  try {
    storage.setItem(ASSESSMENT_PROGRESS_KEY, JSON.stringify(stored));
  } catch {
    /* Storage full or blocked: progress simply is not kept. */
  }
}

/** She has started her trial; the questions are behind her. */
export function clearAssessmentProgress(storage: ProgressStorage | null = sessionStore()): void {
  try {
    storage?.removeItem(ASSESSMENT_PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}
