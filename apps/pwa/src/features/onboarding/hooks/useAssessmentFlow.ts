import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assessmentQuestions } from '../data/assessmentQuestions';
import { getAssessmentOutcome, scoreAssessmentQuestions } from '../data/assessmentOutcome';

type AnswersMap = Record<number, number | undefined>;

export function useAssessmentFlow() {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});

  const question = assessmentQuestions[step];
  const selectedIndex = answers[step];

  // Through `t` rather than a template literal: the separator and digit shaping are part of the
  // translation, not a constant.
  const progressLabel = useMemo(
    () =>
      t('assessment.progress', {
        current: String(step + 1).padStart(2, '0'),
        total: String(assessmentQuestions.length).padStart(2, '0'),
      }),
    [step, t],
  );

  const canContinue = selectedIndex !== undefined;
  const isLastStep = step === assessmentQuestions.length - 1;
  const score = useMemo(() => scoreAssessmentQuestions(answers, assessmentQuestions), [answers]);
  const outcome = useMemo(() => getAssessmentOutcome(score), [score]);

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
    score,
    outcome,
    selectOption,
    goNext,
  };
}
