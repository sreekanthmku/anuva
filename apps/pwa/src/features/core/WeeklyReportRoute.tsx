import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';

const benchmarks = [
  { label: 'Sleep quality', pct: 62, color: '#5E3566', delta: '+12%' },
  { label: 'Hot flashes', pct: 78, color: '#C0405A', delta: '+3 this week' },
  { label: 'Energy level', pct: 54, color: '#C97E92', delta: 'Steady' },
  { label: 'Mood stability', pct: 71, color: '#5E3566', delta: '+8%' },
  { label: 'Cognitive focus', pct: 68, color: '#5B82C4', delta: 'Good' },
  { label: 'Physical activity', pct: 44, color: '#C0405A', delta: '-2 walks' },
];

const statCards = [
  { num: '6.2', unit: 'hrs', label: 'Avg sleep', trend: [3, 4, 3, 5, 4, 6, 5], c: '#5E3566' },
  { num: '4', unit: 'hot flashes', label: 'This week', trend: [1, 0, 1, 2, 1, 3, 2], c: '#C0405A' },
  {
    num: '12,400',
    unit: 'steps/day',
    label: 'Avg activity',
    trend: [8, 10, 7, 12, 9, 14, 12],
    c: '#C97E92',
  },
  { num: '71', unit: '/100', label: 'Wellness', trend: [60, 62, 65, 68, 70, 69, 72], c: '#5E3566' },
];

export default function WeeklyReportRoute() {
  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface">
        <div className="px-3 pb-[22px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow tone="plum">Week 1 · May 1 – 7</Eyebrow>
          <h1 className="font-display mb-1.5 text-[30px] leading-[1.1] text-on-surface">
            Your first{' '}
            <em
              className="not-italic text-primary"
              style={{ fontFamily: '"Fraunces", sans-serif' }}
            >
              benchmark
            </em>
          </h1>
          <p
            className="mb-0 text-[12px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Compared to women 42–50 in early perimenopause
          </p>
        </div>
      </header>

      <section className="px-3 pb-4 pt-2">
        <article className="rounded-[20px] bg-secondary-container px-4 py-4">
          <div className="mb-3 flex items-center justify-between">
            <Eyebrow className="mb-0">Cohort comparison</Eyebrow>
            <span
              className="rounded-full bg-surface-bright px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Week 1
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {benchmarks.map((b) => (
              <div key={b.label}>
                <div className="mb-1 flex justify-between">
                  <span
                    className="text-[12px] text-on-surface"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {b.label}
                  </span>
                  <span
                    className="text-[10.5px] font-medium tracking-[0.05em]"
                    style={{ color: b.color, fontFamily: '"Mulish", sans-serif' }}
                  >
                    {b.delta}
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-bright">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                  />
                  <div
                    className="absolute -top-0.5 left-[60%] h-2.5 w-px bg-outline"
                    aria-hidden="true"
                  />
                </div>
              </div>
            ))}
          </div>
          <p
            className="mt-2.5 text-right text-[9.5px] uppercase tracking-[0.1em] text-outline"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            ⎢ cohort median
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-3 px-3 pb-[22px]">
        <div className="grid grid-cols-2 gap-2.5">
          {statCards.map((m) => {
            const maxT = Math.max(...m.trend, 1);
            return (
              <article
                key={m.label}
                className="rounded-[20px] border border-border-default bg-surface-raised p-3.5 shadow-[0_10px_24px_rgba(94,53,102,0.06)]"
              >
                <div className="flex items-baseline gap-1">
                  <span className="text-[24px] leading-none text-on-surface">{m.num}</span>
                  <span
                    className="ml-1 text-[11px] text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {m.unit}
                  </span>
                </div>
                <div
                  className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-outline"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  {m.label}
                </div>
                <div className="mt-2.5 flex h-[22px] items-end gap-0.5">
                  {m.trend.map((t, i) => (
                    <div
                      key={i}
                      className="min-h-[2px] flex-1 rounded-sm"
                      style={{
                        height: `${Math.max(8, (t / maxT) * 100)}%`,
                        backgroundColor: i === m.trend.length - 1 ? m.c : '#ECDFD0',
                      }}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <article className="rounded-[20px] border border-primary/20 bg-primary-container p-4">
          <Eyebrow tone="plum">↑ Improving</Eyebrow>
          <p
            className="text-[14px] leading-[1.4] text-on-surface"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Your mood stability climbed 8% — the evening walks are working.
          </p>
        </article>

        <article className="rounded-[20px] border border-error/25 bg-error-container p-4">
          <Eyebrow tone="ember">↓ Needs attention</Eyebrow>
          <p
            className="text-[14px] leading-[1.4] text-on-surface"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Hot flashes rose 3 this week. Caffeine after 2pm correlates with 80% of them.
          </p>
        </article>

        <article className="rounded-[20px] border border-border-default bg-primary-container p-[18px]">
          <div className="mb-2.5 flex items-center gap-3">
            <img src="/anu.png" alt="" className="h-[22px] w-[22px] object-contain" />
            <Eyebrow tone="plum" className="mb-0">
              ANU reflects
            </Eyebrow>
          </div>
          <p
            className="text-[17px] leading-[1.4] text-on-surface"
            style={{ fontFamily: '"Fraunces", sans-serif' }}
          >
            &quot;You&apos;re showing the classic pattern of early perimenopause — and you&apos;re
            already ahead of 60% of your cohort on sleep recovery. Shall we discuss a care
            path?&quot;
          </p>
        </article>
      </section>

      <BottomNav />
    </main>
  );
}
