import type { RiskPill } from '../data/assessmentResult';

type RiskIndicatorGridProps = {
  items: RiskPill[];
};

export function RiskIndicatorGrid({ items }: RiskIndicatorGridProps) {
  return (
    <div className="flex gap-2">
      {items.map((item) => (
        <article
          key={item.title}
          className="flex-1 rounded-[14px] border border-border-default bg-surface-container-low p-3"
        >
          <div className="mb-1.5 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            <span
              className="text-[9px] uppercase tracking-[0.12em] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {item.title}
            </span>
          </div>
          <p
            className="text-[16px]"
            style={{ color: item.color, fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
          >
            {item.value}
          </p>
        </article>
      ))}
    </div>
  );
}
