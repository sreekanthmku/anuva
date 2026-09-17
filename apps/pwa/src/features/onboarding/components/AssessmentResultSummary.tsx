import { Trans, useTranslation } from 'react-i18next';
import { RiskIndicatorGrid } from './RiskIndicatorGrid';
import type { RiskPill } from '../data/assessmentResult';
import type { AssessmentOutcomeStatus } from '../data/assessmentOutcome';

type AssessmentResultSummaryProps = {
  score: number;
  status: AssessmentOutcomeStatus;
  riskItems: RiskPill[];
  /** Pill values that are data rather than copy — the score. Keyed by the pill's `titleKey`. */
  literalValues?: Partial<Record<string, string>>;
};

export function AssessmentResultSummary({
  score,
  status,
  riskItems,
  literalValues,
}: AssessmentResultSummaryProps) {
  const { t } = useTranslation();
  const isInControl = status === 'in_control';

  return (
    <section className="px-[22px] pb-[18px] pt-2">
      {isInControl ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          <span
            className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {t('assessmentResult.yourResult')}
          </span>
        </div>
      ) : null}

      {isInControl ? (
        <>
          <h1 className="font-display mb-2.5 text-[32px] leading-[1.1] tracking-[-0.03em] text-on-surface">
            {/* Through Trans: which word carries the emphasis moves with the language, and
                splitting the sentence would pin it to English word order. */}
            <Trans
              i18nKey="assessmentResult.inControlTitle"
              components={{
                1: (
                  <em
                    className="not-italic text-primary"
                    style={{ fontFamily: '"Fraunces", sans-serif' }}
                  />
                ),
              }}
            />
          </h1>
          <p
            className="mb-[18px] text-[13px] leading-[1.55] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {t('assessmentResult.inControlBody', { score })}
          </p>
        </>
      ) : (
        <div className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span
                className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {t('assessmentResult.yourResult')}
              </span>
            </div>
          </div>
          <h1 className="font-display mb-2.5 text-[28px] leading-[1.05] tracking-[-0.03em] text-on-surface">
            <span className="block font-normal">{t('assessmentResult.detectedTitleLine1')}</span>
            <span className="block font-bold">
              <Trans
                i18nKey="assessmentResult.detectedTitleLine2"
                components={{
                  1: (
                    <em
                      className="not-italic text-primary"
                      style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 700 }}
                    />
                  ),
                }}
              />
            </span>
          </h1>
          <p
            className="mb-[18px] text-[16px] leading-[1.6] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {t('assessmentResult.detectedBody')}
          </p>
        </div>
      )}

      <RiskIndicatorGrid items={riskItems} literalValues={literalValues} />
    </section>
  );
}
