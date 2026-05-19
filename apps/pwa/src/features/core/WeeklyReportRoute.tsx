import { type ReactNode } from 'react';
import { BottomNav } from './components/BottomNav';

const benchmarks = [
  { label: 'Sleep quality', pct: 62, color: '#cebdff', delta: '+12%' },
  { label: 'Hot flashes', pct: 78, color: '#F87171', delta: '+3 this week' },
  { label: 'Energy level', pct: 54, color: '#e2c62d', delta: 'Steady' },
  { label: 'Mood stability', pct: 71, color: '#cebdff', delta: '+8%' },
  { label: 'Cognitive focus', pct: 68, color: '#60A5FA', delta: 'Good' },
  { label: 'Physical activity', pct: 44, color: '#F87171', delta: '-2 walks' },
];

const statCards = [
  { num: '6.2', unit: 'hrs', label: 'Avg sleep', trend: [3, 4, 3, 5, 4, 6, 5], c: '#cebdff' },
  { num: '4', unit: 'hot flashes', label: 'This week', trend: [1, 0, 1, 2, 1, 3, 2], c: '#F87171' },
  { num: '12,400', unit: 'steps/day', label: 'Avg activity', trend: [8, 10, 7, 12, 9, 14, 12], c: '#e2c62d' },
  { num: '71', unit: '/100', label: 'Wellness', trend: [60, 62, 65, 68, 70, 69, 72], c: '#cebdff' },
];

function Eyebrow({ children, tone = 'muted', className = '' }: { children: ReactNode; tone?: 'mint' | 'muted' | 'ember'; className?: string }) {
  const line = tone === 'mint' ? 'bg-primary/60' : tone === 'ember' ? 'bg-error/60' : 'bg-outline/60';
  const text = tone === 'mint' ? 'text-primary' : tone === 'ember' ? 'text-error' : 'text-outline';

  return (
    <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${text} ${className}`}>
      <span className={`h-px w-3 ${line}`} />
      <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{children}</span>
    </div>
  );
}

export default function WeeklyReportRoute() {
  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="px-[22px] pb-[22px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow tone="mint">Week 1 · May 1 – 7</Eyebrow>
          <h1
            className="mb-1.5 text-[30px] leading-[1.1] text-on-surface"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
          >
            Your first{' '}
            <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
              benchmark
            </em>
          </h1>
          <p className="mb-0 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Compared to women 42–50 in early perimenopause
          </p>
        </div>
      </header>

      <section className="px-[22px] pb-6 pt-2">
        <div className="flex flex-col gap-3">
          {benchmarks.map((b) => (
            <div key={b.label}>
              <div className="mb-1 flex justify-between">
                <span className="text-[12px] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {b.label}
                </span>
                <span className="text-[10.5px] font-medium tracking-[0.05em]" style={{ color: b.color, fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                  {b.delta}
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-container-high">
                <div className="h-full rounded-full" style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
                <div className="absolute -top-0.5 left-[60%] h-2.5 w-px bg-outline" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2.5 text-right text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
          ⎢ cohort median
        </p>
      </section>

      <section className="flex flex-col gap-3 px-[22px] pb-[22px]">
        <div className="grid grid-cols-2 gap-2.5">
          {statCards.map((m) => {
            const maxT = Math.max(...m.trend, 1);
            return (
              <article key={m.label} className="rounded-[24px] border border-border-default bg-surface-container-low p-3.5">
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-[24px] leading-none text-on-surface"
                    style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 600, fontVariationSettings: '"opsz" 96' }}
                  >
                    {m.num}
                  </span>
                  <span className="ml-1 text-[11px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {m.unit}
                  </span>
                </div>
                <div className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                  {m.label}
                </div>
                <div className="mt-2.5 flex h-[22px] items-end gap-0.5">
                  {m.trend.map((t, i) => (
                    <div
                      key={i}
                      className="min-h-[2px] flex-1 rounded-sm"
                      style={{
                        height: `${Math.max(8, (t / maxT) * 100)}%`,
                        backgroundColor: i === m.trend.length - 1 ? m.c : '#2b2930',
                      }}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>

        <article className="rounded-[24px] border border-primary/30 bg-primary/15 p-4">
          <Eyebrow tone="mint">↑ Improving</Eyebrow>
          <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Your mood stability climbed 8% — the evening walks are working.
          </p>
        </article>

        <article className="rounded-[24px] border border-error/30 bg-error/10 p-4">
          <Eyebrow tone="ember">↓ Needs attention</Eyebrow>
          <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
            Hot flashes rose 3 this week. Caffeine after 2pm correlates with 80% of them.
          </p>
        </article>

        <article className="rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-[18px]">
          <div className="mb-2.5 flex items-center gap-3">
            <img src="/anu.png" alt="" className="h-[22px] w-[22px] object-contain" />
            <Eyebrow tone="mint" className="mb-0">
              ANU reflects
            </Eyebrow>
          </div>
          <p
            className="text-[17px] leading-[1.4] text-on-surface"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}
          >
            &quot;You&apos;re showing the classic pattern of early perimenopause — and you&apos;re already ahead of 60% of your cohort on sleep recovery. Shall we discuss a care
            path?&quot;
          </p>
        </article>
      </section>

      <BottomNav />
    </main>
  );
}
