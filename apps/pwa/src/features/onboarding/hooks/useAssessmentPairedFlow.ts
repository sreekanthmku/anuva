import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assessmentQuestions } from '../data/assessmentQuestions';
import { buildAssessmentPages } from '../data/assessmentPages';
import {
  getAssessmentOutcome,
  reportedSigns,
  scoreAssessmentQuestions,
} from '../data/assessmentOutcome';
import {
  readAssessmentProgress,
  sessionStore,
  writeAssessmentProgress,
  type AssessmentAnswers,
} from '../data/assessmentProgress';
import { useAssessmentStepHistory } from './useAssessmentStepHistory';

type AnswersMap = AssessmentAnswers;

const assessmentPages = buildAssessmentPages(assessmentQuestions.length);

export function useAssessmentPairedFlow() {
  const { t } = useTranslation();
  // Restored, so coming back from the result page lands her where she left off.
  const [restored] = useState(() =>
    readAssessmentProgress(sessionStore(), 'paired', assessmentQuestions, assessmentPages.length),
  );
  const [answers, setAnswers] = useState<AnswersMap>(restored.answers);
  const { step, goToNextStep, goToPreviousStep, canGoBack } = useAssessmentStepHistory(
    restored.step,
    assessmentPages.length,
    (pageIndex) => assessmentPages[pageIndex]!.questionIndices.every((index) => answers[index] !== undefined),
  );

  useEffect(() => {
    writeAssessmentProgress(sessionStore(), 'paired', assessmentQuestions, { step, answers });
  }, [step, answers]);

  const page = assessmentPages[step];
  const questions = useMemo(() => {
    if (!page) return [];
    return page.questionIndices.flatMap((index) => {
      const question = assessmentQuestions[index];
      return question ? [{ index, question }] : [];
    });
  }, [page]);

  // Through `t` rather than a template literal: the separator and digit shaping are part of the
  // translation, not a constant.
  const progressLabel = useMemo(
    () =>
      t('assessment.progress', {
        current: String(step + 1).padStart(2, '0'),
        total: String(assessmentPages.length).padStart(2, '0'),
      }),
    [step, t],
  );

  const canContinue = questions.every(({ index }) => answers[index] !== undefined);
  const isLastStep = step === assessmentPages.length - 1;
  const score = useMemo(() => scoreAssessmentQuestions(answers, assessmentQuestions), [answers]);
  const outcome = useMemo(() => getAssessmentOutcome(score), [score]);
  const signs = useMemo(() => reportedSigns(answers, assessmentQuestions), [answers]);

  const selectOption = (questionIndex: number, optionIndex: number) => {
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const goNext = () => {
    if (!canContinue) return;
    if (!isLastStep) goToNextStep();
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
    signs,
    selectOption,
    goNext,
    getSelectedIndex: (questionIndex: number) => answers[questionIndex],
    canGoBack,
    goBack: goToPreviousStep,
  };
}
