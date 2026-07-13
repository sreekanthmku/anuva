import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';

const COHORT_MEDIAN = 60;

const reportRings = [
  {
    label: 'Sleep quality',
    pct: 62,
    delta: '+12%',
    target: 100,
    color: '#5E3566',
    track: 'rgba(94, 53, 102, 0.13)',
  },
  {
    label: 'Energy level',
    pct: 54,
    delta: 'Steady',
    target: 100,
    color: '#5B82C4',
    track: 'rgba(91, 130, 196, 0.15)',
  },
  {
    label: 'Stress level',
    pct: 58,
    delta: 'Improving',
    target: 100,
    color: '#7A3A4C',
    track: 'rgba(122, 58, 76, 0.15)',
  },
  {
    label: 'Mood stability',
    pct: 71,
    delta: '+8%',
    target: 100,
    color: '#C97E92',
    track: 'rgba(201, 126, 146, 0.17)',
  },
  {
    label: 'Cognitive focus',
    pct: 68,
    delta: 'Good',
    target: 100,
    color: '#B8923C',
    track: 'rgba(184, 146, 60, 0.17)',
  },
  {
    label: 'Physical activity',
    pct: 44,
    delta: '-2 walks',
    target: 100,
    color: '#4F9D6B',
    track: 'rgba(79, 157, 107, 0.15)',
  },
];

const statCards = [
  { num: '6.2', unit: 'hrs', label: 'Avg sleep', trend: [3, 4, 3, 5, 4, 6, 5], c: '#5E3566' },
  { num: '4', unit: 'hot flashes', label: 'This week', trend: [1, 0, 1, 2, 1, 3, 2], c: '#C0405A' },
  {
    num: '12,400',
    unit: 'steps/day',
    label: 'Avg activity',
    trend: [8, 10, 7, 12, 9, 14, 12],
    c: '#4F9D6B',
  },
  { num: '71', unit: '/100', label: 'Wellness', trend: [60, 62, 65, 68, 70, 69, 72], c: '#5E3566' },
];

type ReportRing = (typeof reportRings)[number];

function ReportRingCard({ ring }: { ring: ReportRing }) {
  const svgSize = 88;
  const center = svgSize / 2;
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(ring.pct / ring.target, 0), 1);
  const medianAngle = (COHORT_MEDIAN / ring.target) * 360 - 90;
  const medianX = center + radius * Math.cos((medianAngle * Math.PI) / 180);
  const medianY = center + radius * Math.sin((medianAngle * Math.PI) / 180);

  return (
    <div className="flex flex-col items-center rounded-starchart-lg bg-surface-bright px-1 py-1.5">
      <div className="relative h-[88px] w-[88px] shrink-0">
        <svg
          width={svgSize}
          height={svgSize}
          viewBox={`0 0 ${svgSize} ${svgSize}`}
          role="img"
          aria-label={`${ring.label} ${ring.pct}% with cohort median marker`}
          className="block"
        >
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ring.track}
            strokeWidth="9"
          />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ring.color}
            strokeWidth="9"
            strokeDasharray={`${circumference * progress} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
          />
          <circle
            cx={medianX}
            cy={medianY}
            r="2.2"
            fill="#FBF6F0"
            stroke={ring.color}
            strokeWidth="1.4"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[16px] font-semibold leading-none"
            style={{ color: ring.color, fontFamily: '"Mulish", sans-serif' }}
          >
            {ring.pct}%
          </span>
        </div>
      </div>
      <div className="mt-1 min-w-0 text-center">
        <p
          className="truncate text-[11.5px] leading-[1.2] text-on-surface"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {ring.label}
        </p>
        <span
          className="mt-0.5 block text-[9.5px] font-medium leading-none tracking-[0.04em]"
          style={{ color: ring.color, fontFamily: '"Mulish", sans-serif' }}
        >
          {ring.delta}
        </span>
      </div>
    </div>
  );
}

function ReportProgressRings() {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {reportRings.slice(0, 3).map((ring) => (
          <ReportRingCard key={ring.label} ring={ring} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {reportRings.slice(3).map((ring) => (
          <ReportRingCard key={ring.label} ring={ring} />
        ))}
      </div>
    </div>
  );
}

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
        <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow className="mb-0">Weekly tracker</Eyebrow>
            <span
              className="rounded-full bg-surface-bright px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Week 1
            </span>
          </div>
          <ReportProgressRings />
          <p
            className="mt-2 rounded-starchart-lg bg-surface-bright px-3 py-1.5 text-center text-[11px] leading-[1.35] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            Small dots mark the 60% cohort median from your previous comparison.
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
                className="rounded-[20px] border border-border-default bg-surface-raised p-3.5"
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
