import { useTranslation } from 'react-i18next';
import type { RiskPill } from '../data/assessmentResult';

type RiskIndicatorGridProps = {
  items: RiskPill[];
  /**
   * A pill whose value is a number rather than a phrase — the score. Keyed by `titleKey`, so the
   * grid stays a dumb renderer and the route decides what is literal.
   */
  literalValues?: Partial<Record<string, string>>;
};

export function RiskIndicatorGrid({ items, literalValues }: RiskIndicatorGridProps) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <article
          key={item.titleKey}
          className="flex-1 rounded-[14px] border border-border-default bg-surface-container-low p-3"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span
              className="text-[9px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {t(`assessmentResult.pills.${item.titleKey}`)}
            </span>
          </div>
          <p
            className="text-[16px]"
            style={{ color: item.color, fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
          >
            {literalValues?.[item.titleKey] ?? t(`assessmentResult.values.${item.valueKey}`)}
          </p>
        </article>
      ))}
    </div>
  );
}
