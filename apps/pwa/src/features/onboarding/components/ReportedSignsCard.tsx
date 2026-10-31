import { useTranslation } from 'react-i18next';
import type { ReportedSign } from '../data/assessmentOutcome';

type ReportedSignsCardProps = {
  signs: ReportedSign[];
  /** How many signs she was asked about — the "of 10". */
  total: number;
};

/**
 * Why the result says what it says: the signs she reported, in her own answers. Each line is
 * `assessmentResult.signs.<question id>`, and how often reuses the answer labels she tapped.
 */
export function ReportedSignsCard({ signs, total }: ReportedSignsCardProps) {
  const { t } = useTranslation();

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-container-low p-[18px]">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
        <span className="h-px w-3 bg-primary/60" />
        <span style={{ fontFamily: '"Mulish", sans-serif' }}>{t('assessmentResult.whyTitle')}</span>
      </div>
      <p
        className="mb-2 text-[13px] leading-[1.5] text-on-surface-variant"
        style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
      >
        {t('assessmentResult.whyCount', { reported: signs.length, total })}
      </p>

      <ul className="divide-y divide-border-default">
        {signs.map((sign) => {
          const isYes = sign.value === 'yes';
          return (
            <li key={sign.id} className="flex items-center gap-3 py-2">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${isYes ? 'bg-primary' : 'bg-outline'}`}
                aria-hidden
              />
              <span
                className="flex-1 text-[14px] text-on-surface"
                style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
              >
                {t(`assessmentResult.signs.${sign.id}`)}
              </span>
              <span
                className={`text-[12px] ${isYes ? 'font-semibold text-primary' : 'text-on-surface-variant'}`}
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {t(`assessment.options.${sign.value}`)}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
