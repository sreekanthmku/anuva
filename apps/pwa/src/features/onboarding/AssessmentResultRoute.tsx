import { useLocation, useNavigate } from 'react-router-dom';
import { assessmentPath } from './config/assessmentView';
import { AssessmentResultCTA } from './components/AssessmentResultCTA';
import { AssessmentResultNavBar } from './components/AssessmentResultNavBar';
import { AssessmentResultSummary } from './components/AssessmentResultSummary';
import { NextStepsCard } from './components/NextStepsCard';
import { controlNextSteps, nextSteps, riskPills } from './data/assessmentResult';
import type { AssessmentOutcome, AssessmentOutcomeStatus } from './data/assessmentOutcome';
import type { RiskPill } from './data/assessmentResult';

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

  const state = (location.state as AssessmentResultRouteState) ?? readStoredOutcome();
  const score = state?.score ?? 0;
  const status: AssessmentOutcomeStatus = state?.status ?? 'in_control';
  const isInControl = status === 'in_control';
  const summaryItems: RiskPill[] = isInControl
    ? [
        { title: 'Score', value: `${score}`, color: '#cebdff' },
        { title: 'Status', value: 'In control', color: '#e2c62d' },
        { title: 'Check back', value: '3 months', color: '#60A5FA' },
      ]
    : riskPills;
  const steps = isInControl ? controlNextSteps : nextSteps;
  const primaryDestination = isInControl ? '/home' : '/subscription';

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pt-[40px] text-on-surface">
      <AssessmentResultNavBar onBack={() => navigate(assessmentPath())} />
      <AssessmentResultSummary score={score} status={status} riskItems={summaryItems} />

      <section className="px-[22px] pb-[18px] pt-1">
        <NextStepsCard steps={steps} />
        <AssessmentResultCTA status={status} onPrimary={() => navigate(primaryDestination)} />
      </section>
    </main>
  );
}
