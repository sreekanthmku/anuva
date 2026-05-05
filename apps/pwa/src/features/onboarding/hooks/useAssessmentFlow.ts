import { useMemo, useState } from 'react';
import { assessmentQuestions } from '../data/assessmentQuestions';

type AnswersMap = Record<number, number | undefined>;

export function useAssessmentFlow() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});

  const question = assessmentQuestions[step];
  const selectedIndex = answers[step];

  const progressLabel = useMemo(() => {
    const current = String(step + 1).padStart(2, '0');
    const total = String(assessmentQuestions.length).padStart(2, '0');
    return `${current} / ${total}`;
  }, [step]);

  const canContinue = selectedIndex !== undefined;
  const isLastStep = step === assessmentQuestions.length - 1;

  const selectOption = (optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [step]: optionIndex }));
  };

  const goNext = () => {
    if (!canContinue) return;
    if (!isLastStep) setStep((prev) => prev + 1);
  };

  return {
    step,
    question,
    totalSteps: assessmentQuestions.length,
    selectedIndex,
    progressLabel,
    canContinue,
    isLastStep,
    selectOption,
    goNext,
  };
}

