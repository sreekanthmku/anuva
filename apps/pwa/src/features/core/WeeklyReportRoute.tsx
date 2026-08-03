import type { ReportRing, ReportRingKey, ReportStat, WeeklyReportResponse } from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { BottomNav } from './components/BottomNav';
import { useWeeklyReport } from './hooks/useWeeklyReport';

const RING_COLORS: Record<ReportRingKey, { color: string; track: string }> = {
  sleep: { color: '#5E3566', track: 'rgba(94, 53, 102, 0.13)' },
  energy: { color: '#5B82C4', track: 'rgba(91, 130, 196, 0.15)' },
  stress: { color: '#7A3A4C', track: 'rgba(122, 58, 76, 0.15)' },
  mood: { color: '#C97E92', track: 'rgba(201, 126, 146, 0.17)' },
  focus: { color: '#B8923C', track: 'rgba(184, 146, 60, 0.17)' },
  hotFlashes: { color: '#C0405A', track: 'rgba(192, 64, 90, 0.15)' },
};

const STAT_COLORS: Record<string, string> = {
  avgSleep: '#5E3566',
  hotFlashes: '#C0405A',
  wellness: '#5E3566',
};

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const sameMonth = start.getMonth() === end.getMonth();
  return sameMonth
    ? `${month(start)} ${start.getDate()} – ${end.getDate()}`
    : `${month(start)} ${start.getDate()} – ${month(end)} ${end.getDate()}`;
}

function ReportRingCard({ ring }: { ring: ReportRing }) {
  const svgSize = 88;
  const center = svgSize / 2;
  const radius = 37;
  const circumference = 2 * Math.PI * radius;
  const { color, track } = RING_COLORS[ring.key];
  const hasData = ring.pct != null;
  const progress = Math.min(Math.max((ring.pct ?? 0) / 100, 0), 1);
  const medianAngle = (ring.cohortMedian / 100) * 360 - 90;
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
          aria-label={
            hasData
              ? `${ring.label} ${ring.pct}% with reference marker at ${ring.cohortMedian}%`
              : `${ring.label} — not logged this week`
          }
          className="block"
        >
          <circle cx={center} cy={center} r={radius} fill="none" stroke={track} strokeWidth="9" />
          {hasData && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeDasharray={`${circumference * progress} ${circumference}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
          <circle cx={medianX} cy={medianY} r="2.2" fill="#FBF6F0" stroke={color} strokeWidth="1.4" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[16px] font-semibold leading-none"
            style={{ color: hasData ? color : '#B9A79A', fontFamily: '"Mulish", sans-serif' }}
          >
            {hasData ? `${ring.pct}%` : '—'}
          </span>
        </div>
      </div>
      <div className="mt-1 min-w-0 text-center">
        <p className="truncate text-[11.5px] leading-[1.2] text-on-surface" style={{ fontFamily: MULISH }}>
          {ring.label}
        </p>
        <span
          className="mt-0.5 block text-[9.5px] font-medium leading-none tracking-[0.04em]"
          style={{ color: hasData ? color : '#B9A79A', fontFamily: '"Mulish", sans-serif' }}
        >
          {hasData ? ring.delta : 'Not logged'}
        </span>
      </div>
    </div>
  );
}

function ReportProgressRings({ rings }: { rings: ReportRing[] }) {
  return (
    <div className="mx-auto flex w-full max-w-[460px] flex-col gap-2">
      <div className="grid grid-cols-3 gap-1.5">
        {rings.slice(0, 3).map((ring) => (
          <ReportRingCard key={ring.key} ring={ring} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {rings.slice(3).map((ring) => (
          <ReportRingCard key={ring.key} ring={ring} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ stat, wide }: { stat: ReportStat; wide?: boolean }) {
  const maxT = Math.max(...stat.trend, 1);
  const color = STAT_COLORS[stat.key] ?? '#5E3566';

  return (
    <article
      className={`rounded-[20px] border border-border-default bg-surface-raised p-3.5 ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <div className="flex items-baseline gap-1">
        <span className="text-[24px] leading-none text-on-surface">{stat.value ?? '—'}</span>
        <span className="ml-1 text-[11px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
          {stat.unit}
        </span>
      </div>
      <div
        className="mt-1.5 text-[9.5px] uppercase tracking-[0.1em] text-outline"
        style={{ fontFamily: '"Mulish", sans-serif' }}
      >
        {stat.label}
      </div>
      <div className="mt-2.5 flex h-[22px] items-end gap-0.5">
        {stat.trend.map((t, i) => (
          <div
            key={i}
            className="min-h-[2px] flex-1 rounded-sm"
            style={{
              height: `${Math.max(8, (t / maxT) * 100)}%`,
              backgroundColor: i === stat.trend.length - 1 && t > 0 ? color : '#ECDFD0',
            }}
          />
        ))}
      </div>
    </article>
  );
}

function ReportSkeleton() {
  return (
    <section className="flex flex-col gap-3 px-3 pb-[22px] pt-2" aria-busy="true">
      <div className="h-[248px] animate-pulse rounded-[20px] bg-surface-raised" />
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[104px] animate-pulse rounded-[20px] bg-surface-raised" />
        <div className="h-[104px] animate-pulse rounded-[20px] bg-surface-raised" />
      </div>
      <div className="h-[96px] animate-pulse rounded-[20px] bg-surface-raised" />
    </section>
  );
}

function ReportBody({ report }: { report: WeeklyReportResponse }) {
  const wellness = report.stats.find((s) => s.key === 'wellness');
  const others = report.stats.filter((s) => s.key !== 'wellness');
  const hasAnyData = report.daysLogged > 0;

  return (
    <>
      <section className="px-3 pb-4 pt-2">
        <article className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
          <div className="mb-2.5 flex items-center justify-between">
            <Eyebrow className="mb-0">Weekly tracker</Eyebrow>
            <span
              className="rounded-full bg-surface-bright px-3 py-1 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {report.daysLogged}/{report.daysElapsed} days logged
            </span>
          </div>
          <ReportProgressRings rings={report.rings} />
          <p
            className="mt-2 rounded-starchart-lg bg-surface-bright px-3 py-1.5 text-center text-[11px] leading-[1.35] text-on-surface-variant"
            style={{ fontFamily: MULISH }}
          >
            Small dots mark the typical level for {report.cohortLabel}.
          </p>
        </article>
      </section>

      <section className="flex flex-col gap-3 px-3 pb-[22px]">
        {hasAnyData && (
          <div className="grid grid-cols-2 gap-2.5">
            {others.map((stat) => (
              <StatCard key={stat.key} stat={stat} />
            ))}
            {wellness && <StatCard stat={wellness} wide />}
          </div>
        )}

        {report.calibrating && (
          <article className="rounded-[20px] border border-tertiary/25 bg-surface-raised p-4">
            <Eyebrow tone="gold">Still calibrating</Eyebrow>
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              Day {report.daysElapsed} of 7. These numbers settle once your first full week is in.
            </p>
          </article>
        )}

        {report.insights.map((insight) => (
          <article
            key={insight.title}
            className={
              insight.tone === 'positive'
                ? 'rounded-[20px] border border-primary/20 bg-primary-container p-4'
                : 'rounded-[20px] border border-error/25 bg-error-container p-4'
            }
          >
            <Eyebrow tone={insight.tone === 'positive' ? 'plum' : 'ember'}>{insight.title}</Eyebrow>
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              {insight.body}
            </p>
          </article>
        ))}

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
            &quot;{report.anuReflection}&quot;
          </p>
        </article>
      </section>
    </>
  );
}

export default function WeeklyReportRoute() {
  const { data, loading, error, refresh } = useWeeklyReport();

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface">
        <div className="px-3 pb-[22px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow tone="plum">
            {data ? `Week ${data.weekNumber} · ${formatRange(data.weekStart, data.weekEnd)}` : 'Your week'}
          </Eyebrow>
          <h1 className="font-display mb-1.5 text-[30px] leading-[1.1] text-on-surface">
            Your{' '}
            <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces", sans-serif' }}>
              benchmark
            </em>
          </h1>
          <p className="mb-0 text-[12px] text-on-surface-variant" style={{ fontFamily: MULISH }}>
            Compared to {data?.cohortLabel ?? 'women 42–50 in early perimenopause'}
          </p>
        </div>
      </header>

      {loading && <ReportSkeleton />}

      {!loading && error && (
        <section className="px-3 pt-2">
          <article className="rounded-[20px] border border-error/25 bg-error-container p-4">
            <p className="text-[14px] leading-[1.4] text-on-surface" style={{ fontFamily: MULISH }}>
              {error}
            </p>
            <button
              type="button"
              onClick={refresh}
              className="mt-3 min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary"
              style={{ fontFamily: MULISH }}
            >
              Try again
            </button>
          </article>
        </section>
      )}

      {!loading && !error && data && <ReportBody report={data} />}

      <BottomNav />
    </main>
  );
}
