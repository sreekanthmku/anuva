/**
 * The pre-assessment, as structure only.
 *
 * Neither the prompt nor the answer labels live here any more — they are resolved through
 * `assessment.questions.<id>` and `assessment.options.<value>` at render. What stays is the part
 * that must never change with the language: the question order, each question's id, and the
 * *values* its options carry. Scoring keys off those values (see `assessmentOutcome.ts`), so a
 * woman answering in Tamil scores identically to one answering in English.
 */

export type AssessmentOptionValue =
  | 'yes'
  | 'no'
  | 'sometimes'
  | 'age_29_below'
  | 'age_30_34'
  | 'age_35_40'
  | 'age_41_45'
  | 'age_46_50'
  | 'age_51_above';

export type AssessmentQuestion = {
  id: string;
  /** Option values, in display order. Resolved to copy through `assessment.options.<value>`. */
  options: AssessmentOptionValue[];
};

const YES_NO_SOMETIMES: AssessmentOptionValue[] = ['yes', 'no', 'sometimes'];

export const assessmentQuestions: AssessmentQuestion[] = [
  { id: 'periods-unpredictable', options: YES_NO_SOMETIMES },
  { id: 'hot-flashes', options: YES_NO_SOMETIMES },
  { id: 'night-sweats', options: YES_NO_SOMETIMES },
  { id: 'mood-swings', options: YES_NO_SOMETIMES },
  { id: 'weight-gain', options: YES_NO_SOMETIMES },
  { id: 'vaginal-dryness', options: YES_NO_SOMETIMES },
  { id: 'brain-fog', options: YES_NO_SOMETIMES },
  { id: 'low-interest-intimacy', options: YES_NO_SOMETIMES },
  { id: 'facial-hair-body-odour', options: YES_NO_SOMETIMES },
  { id: 'aches-fatigue', options: YES_NO_SOMETIMES },
  {
    id: 'age-bracket',
    options: [
      'age_29_below',
      'age_30_34',
      'age_35_40',
      'age_41_45',
      'age_46_50',
      'age_51_above',
    ],
  },
];
