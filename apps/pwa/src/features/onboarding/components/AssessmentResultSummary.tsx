import { RiskIndicatorGrid } from './RiskIndicatorGrid';
import type { RiskPill } from '../data/assessmentResult';
import type { AssessmentOutcomeStatus } from '../data/assessmentOutcome';

type AssessmentResultSummaryProps = {
  score: number;
  status: AssessmentOutcomeStatus;
  riskItems: RiskPill[];
};

export function AssessmentResultSummary({ score, status, riskItems }: AssessmentResultSummaryProps) {
  const isInControl = status === 'in_control';

  return (
    <section className="px-[22px] pb-[18px] pt-2">
      {isInControl ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#cebdff]" />
          <span
            className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            Your result
          </span>
        </div>
      ) : null}

      {isInControl ? (
        <>
          <h1
            className="font-display mb-2.5 text-[32px] leading-[1.1] tracking-[-0.03em] text-on-surface"
          >
            Everything is in{' '}
            <em
              className="not-italic text-primary"
              style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
            >
              control
            </em>
            .
          </h1>
          <p
            className="mb-[18px] text-[13px] leading-[1.55] text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Your assessment score is {score}. Check back after 3 months.
          </p>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#cebdff]" />
              <span
                className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
                style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
              >
                Your result
              </span>
            </div>
          </div>
          <h1
            className="font-display mb-2.5 text-[28px] leading-[1.05] tracking-[-0.03em] text-on-surface"
          >
            <span className="block font-normal">Strong indicators of</span>
            <span className="block font-bold">
              <em
                className="not-italic text-primary"
                style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 700 }}
              >
                perimenopause
              </em>{' '}
              detected
            </span>
          </h1>
          <p
            className="mb-[18px] text-[16px] leading-[1.6] text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Based on your responses, you&apos;re likely in early-stage transition. Clinically common for women 42-50.
          </p>
        </div>
      )}

      <RiskIndicatorGrid items={riskItems} />
    </section>
  );
}
