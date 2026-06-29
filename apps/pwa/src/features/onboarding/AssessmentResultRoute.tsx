import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { startTrial } from '../auth/session';
import { assessmentPath } from './config/assessmentView';
import { AssessmentResultCTA } from './components/AssessmentResultCTA';
import { AssessmentResultNavBar } from './components/AssessmentResultNavBar';
import { AssessmentResultSummary } from './components/AssessmentResultSummary';
import { NextStepsCard } from './components/NextStepsCard';
import { controlNextSteps, nextSteps, riskPills } from './data/assessmentResult';
import type { AssessmentOutcome, AssessmentOutcomeStatus } from './data/assessmentOutcome';
import type { RiskPill } from './data/assessmentResult';
import { persistOnboardingCompletionIfAuthenticated } from './persistOnboardingCompletion';

type AssessmentResultRouteState = AssessmentOutcome | null;

const readStoredOutcome = (): AssessmentResultRouteState => {
  try {
    const raw = window.sessionStorage.getItem('anuva-assessment-result');
    if (!raw) return null;
    return JSON.parse(raw) as AssessmentResultRouteState;
  } catch {
    return null;
  }
};

export default function AssessmentResultRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const [isStartingTrial, setIsStartingTrial] = useState(false);

  useEffect(() => {
    persistOnboardingCompletionIfAuthenticated(user, refreshUser);
  }, [user, refreshUser]);

  const state = (location.state as AssessmentResultRouteState) ?? readStoredOutcome();
  const score = state?.score ?? 0;
  const status: AssessmentOutcomeStatus = state?.status ?? 'in_control';
  const isInControl = status === 'in_control';
  const summaryItems: RiskPill[] = isInControl
    ? [
        { title: 'Score', value: `${score}`, color: '#5E3566' },
        { title: 'Status', value: 'In control', color: '#C97E92' },
        { title: 'Check back', value: '3 months', color: '#5B82C4' },
      ]
    : riskPills;
  const steps = isInControl ? controlNextSteps : nextSteps;
  async function handlePrimaryAction() {
    if (!user) {
      navigate('/login');
      return;
    }

    if (user.hasActiveAccess) {
      navigate('/anu-greeting');
      return;
    }

    setIsStartingTrial(true);
    try {
      await startTrial();
      await refreshUser();
      navigate('/anu-greeting');
    } catch (error) {
      console.error(error);
      navigate('/subscription');
    } finally {
      setIsStartingTrial(false);
    }
  }

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pt-[40px] text-on-surface">
      <AssessmentResultNavBar onBack={() => navigate(assessmentPath())} />
      <AssessmentResultSummary score={score} status={status} riskItems={summaryItems} />

      <section className="px-3 pb-[18px] pt-1">
        <NextStepsCard steps={steps} />
        <AssessmentResultCTA
          onPrimary={() => void handlePrimaryAction()}
          isSubmitting={isStartingTrial}
        />
      </section>
    </main>
  );
}
