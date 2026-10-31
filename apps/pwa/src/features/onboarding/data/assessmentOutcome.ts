import type { AssessmentOptionValue, AssessmentQuestion } from './assessmentQuestions';

export type AssessmentOutcomeStatus = 'in_control' | 'further_assessment';

export type AssessmentOutcome = {
  score: number;
  threshold: number;
  status: AssessmentOutcomeStatus;
};

/**
 * Scored off the option's *value*, never its label. The labels are translated; the values are not,
 * so an answer weighs the same whichever language it was given in.
 */
const answerScoreByValue: Partial<Record<AssessmentOptionValue, number>> = {
  yes: 2,
  sometimes: 1,
  no: 0,
};

export function scoreAssessmentQuestions(
  answers: Record<number, number | undefined>,
  questions: AssessmentQuestion[]
) {
  return questions.reduce((total, question, index) => {
    const selectedIndex = answers[index];
    if (selectedIndex === undefined) {
      return total;
    }

    const selectedOption = question.options[selectedIndex];
    if (selectedOption === undefined) {
      return total;
    }

    const questionScore = answerScoreByValue[selectedOption] ?? 0;
    return total + questionScore;
  }, 0);
}

export function getAssessmentOutcome(score: number, threshold = 8): AssessmentOutcome {
  return {
    score,
    threshold,
    status: score < threshold ? 'in_control' : 'further_assessment',
  };
}

/** A sign she said yes or sometimes to: the question's id and how often. Values, never copy. */
export type ReportedSign = { id: string; value: 'yes' | 'sometimes' };

/** What the result screen is handed: the outcome, plus the answers behind it. */
export type AssessmentResult = AssessmentOutcome & { signs: ReportedSign[] };

/**
 * The signs behind her score, so the result can say why. "Yes" before "sometimes", each group in
 * question order.
 */
export function reportedSigns(
  answers: Record<number, number | undefined>,
  questions: AssessmentQuestion[]
): ReportedSign[] {
  const signs = questions.flatMap((question, index): ReportedSign[] => {
    const selectedIndex = answers[index];
    const value = selectedIndex === undefined ? undefined : question.options[selectedIndex];
    return value === 'yes' || value === 'sometimes' ? [{ id: question.id, value }] : [];
  });
  return [
    ...signs.filter((sign) => sign.value === 'yes'),
    ...signs.filter((sign) => sign.value === 'sometimes'),
  ];
}

/** How many questions carry a score at all: the "of 10" in "6 of 10 common signs". */
export function countScoredQuestions(questions: AssessmentQuestion[]): number {
  return questions.filter((question) =>
    question.options.some((option) => answerScoreByValue[option] !== undefined)
  ).length;
}
