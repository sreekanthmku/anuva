import type { AssessmentQuestion } from './assessmentQuestions';

export type AssessmentOutcomeStatus = 'in_control' | 'further_assessment';

export type AssessmentOutcome = {
  score: number;
  threshold: number;
  status: AssessmentOutcomeStatus;
};

const answerScoreByLabel: Record<string, number> = {
  Yes: 2,
  Sometimes: 1,
  No: 0,
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

    const questionScore = answerScoreByLabel[selectedOption] ?? 0;
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
