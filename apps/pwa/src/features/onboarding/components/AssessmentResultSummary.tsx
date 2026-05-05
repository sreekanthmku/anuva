import { RiskIndicatorGrid } from './RiskIndicatorGrid';
import type { RiskPill } from '../data/assessmentResult';

type AssessmentResultSummaryProps = {
  riskItems: RiskPill[];
};

export function AssessmentResultSummary({ riskItems }: AssessmentResultSummaryProps) {
  return (
    <section className="px-[22px] pb-[18px] pt-2">
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_10px_#cebdff]" />
        <span
          className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
        >
          Your result
        </span>
      </div>

      <h1
        className="mb-2.5 text-[32px] leading-[1.1] tracking-[-0.03em] text-on-surface"
        style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontVariationSettings: '"opsz" 144' }}
      >
        Strong indicators of{' '}
        <em
          className="not-italic text-primary"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
        >
          perimenopause
        </em>{' '}
        detected.
      </h1>
      <p
        className="mb-[18px] text-[13px] leading-[1.55] text-on-surface-variant"
        style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
      >
        Based on your responses, you&apos;re likely in early-stage transition. Clinically common for women 42-50.
      </p>

      <RiskIndicatorGrid items={riskItems} />
    </section>
  );
}
