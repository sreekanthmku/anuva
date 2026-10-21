import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assessmentQuestions } from '../data/assessmentQuestions';
import { getAssessmentOutcome, scoreAssessmentQuestions } from '../data/assessmentOutcome';
import {
  readAssessmentProgress,
  sessionStore,
  writeAssessmentProgress,
  type AssessmentAnswers,
} from '../data/assessmentProgress';

type AnswersMap = AssessmentAnswers;

export function useAssessmentFlow() {
  const { t } = useTranslation();
  // Restored, so coming back from the result page lands her where she left off.
  const [restored] = useState(() =>
    readAssessmentProgress(sessionStore(), 'single', assessmentQuestions, assessmentQuestions.length),
  );
  const [step, setStep] = useState(restored.step);
  const [answers, setAnswers] = useState<AnswersMap>(restored.answers);

  useEffect(() => {
    writeAssessmentProgress(sessionStore(), 'single', assessmentQuestions, { step, answers });
  }, [step, answers]);

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
