import { Trans, useTranslation } from 'react-i18next';
import { ReportedSignsCard } from './ReportedSignsCard';
import { RiskIndicatorGrid } from './RiskIndicatorGrid';
import type { RiskPill } from '../data/assessmentResult';
import { assessmentQuestions } from '../data/assessmentQuestions';
import { countScoredQuestions } from '../data/assessmentOutcome';
import type { AssessmentOutcomeStatus, ReportedSign } from '../data/assessmentOutcome';

type AssessmentResultSummaryProps = {
  score: number;
  status: AssessmentOutcomeStatus;
  /** In control: the score, status and check-back pills. */
  riskItems: RiskPill[];
  /**
   * Further assessment: the signs she reported, shown as the reason for the result. Empty for a
   * result stored before signs were kept, and then the reason is left out rather than guessed.
   */
  signs: ReportedSign[];
  /** Pill values that are data rather than copy — the score. Keyed by the pill's `titleKey`. */
  literalValues?: Partial<Record<string, string>>;
};

export function AssessmentResultSummary({
  score,
  status,
  riskItems,
  signs,
  literalValues,
}: AssessmentResultSummaryProps) {
  const { t } = useTranslation();
  const isInControl = status === 'in_control';

  return (
    <section className="px-[22px] pb-[18px] pt-2">
      {isInControl ? (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
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
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              <span
                className="text-[9.5px] uppercase tracking-[0.18em] text-primary"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {t('assessmentResult.yourResult')}
              </span>
            </div>
          </div>
          {/* "May be", not "detected": ten questions are a starting point, not a diagnosis. */}
          <h1 className="font-display mb-2.5 text-[28px] leading-[1.15] tracking-[-0.03em] text-on-surface">
            <Trans
              i18nKey="assessmentResult.likelyTitle"
              components={{
                1: (
                  <em
                    className="not-italic text-primary"
                    style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 700 }}
                  />
                ),
              }}
            />
          </h1>
          <p
            className="mb-[18px] text-[15px] leading-[1.6] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            {t('assessmentResult.likelyBody')}
          </p>
        </div>
      )}

      {isInControl ? (
        <RiskIndicatorGrid items={riskItems} literalValues={literalValues} />
      ) : signs.length > 0 ? (
        <ReportedSignsCard signs={signs} total={countScoredQuestions(assessmentQuestions)} />
      ) : null}
    </section>
  );
}
