import { useNavigate } from 'react-router-dom';
import { AssessmentResultCTA } from './components/AssessmentResultCTA';
import { AssessmentResultNavBar } from './components/AssessmentResultNavBar';
import { AssessmentResultSummary } from './components/AssessmentResultSummary';
import { NextStepsCard } from './components/NextStepsCard';
import { nextSteps, riskPills } from './data/assessmentResult';

export default function AssessmentResultRoute() {
  const navigate = useNavigate();

  return (
    <main className="min-h-mobile overflow-auto bg-surface text-on-surface">
      <AssessmentResultNavBar onBack={() => navigate('/assessment')} />
      <AssessmentResultSummary riskItems={riskPills} />

      <section className="px-[22px] pb-[18px] pt-1">
        <NextStepsCard steps={nextSteps} />
        <AssessmentResultCTA onPrimary={() => navigate('/subscription')} />
      </section>
    </main>
  );
}
