import { useMemo, useState } from 'react';
import { assessmentQuestions } from '../data/assessmentQuestions';
import { buildAssessmentPages } from '../data/assessmentPages';
import { getAssessmentOutcome, scoreAssessmentQuestions } from '../data/assessmentOutcome';

type AnswersMap = Record<number, number | undefined>;

const assessmentPages = buildAssessmentPages(assessmentQuestions.length);

export function useAssessmentPairedFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});

  const page = assessmentPages[step];
  const questions = useMemo(() => {
    if (!page) return [];
    return page.questionIndices.flatMap((index) => {
      const question = assessmentQuestions[index];
      return question ? [{ index, question }] : [];
    });
  }, [page]);

  const progressLabel = useMemo(() => {
    const current = String(step + 1).padStart(2, '0');
    const total = String(assessmentPages.length).padStart(2, '0');
    return `${current} / ${total}`;
  }, [step]);

  const canContinue = questions.every(({ index }) => answers[index] !== undefined);
  const isLastStep = step === assessmentPages.length - 1;
  const score = useMemo(() => scoreAssessmentQuestions(answers, assessmentQuestions), [answers]);
  const outcome = useMemo(() => getAssessmentOutcome(score), [score]);

  const selectOption = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const goNext = () => {
    if (!canContinue) return;
    if (!isLastStep) setStep((prev) => prev + 1);
  };

  return {
    step,
    questions,
    totalSteps: assessmentPages.length,
    progressLabel,
    canContinue,
    isLastStep,
    score,
    outcome,
    selectOption,
    goNext,
    getSelectedIndex: (questionIndex: number) => answers[questionIndex],
  };
}
