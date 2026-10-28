import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  backAction,
  furthestReachableStep,
  readHistoryStep,
  type AssessmentStepState,
} from '../data/assessmentStepHistory';

/**
 * The current step, kept in browser history so the back gesture and the back chevron agree.
 * `restoredStep` is used for the entry she arrived on, which has no step of its own yet.
 */
export function useAssessmentStepHistory(
  restoredStep: number,
  totalSteps: number,
  isStepAnswered: (step: number) => boolean,
) {
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;

  const historyStep = readHistoryStep(location.state, totalSteps);
  const step = Math.min(historyStep ?? restoredStep, furthestReachableStep(totalSteps, isStepAnswered));

  // Stamp the entry she arrived on, so after a reload each entry still knows its own step.
  useEffect(() => {
    if (historyStep === undefined) {
      const state: AssessmentStepState = { assessmentStep: step };
      navigate(here, { replace: true, state });
    }
  }, [historyStep, step, here, navigate]);

  const goToNextStep = () => {
    if (step >= totalSteps - 1) return;
    const state: AssessmentStepState = { assessmentStep: step + 1, pushedByNext: true };
    navigate(here, { state });
  };

  const goToPreviousStep = () => {
    const action = backAction(location.state, step, totalSteps);
    if (action === 'pop') {
      navigate(-1);
    } else if (action === 'replace') {
      const state: AssessmentStepState = { assessmentStep: step - 1 };
      navigate(here, { replace: true, state });
    }
  };

  return { step, goToNextStep, goToPreviousStep, canGoBack: step > 0 };
}
