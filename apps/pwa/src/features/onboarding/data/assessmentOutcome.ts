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
