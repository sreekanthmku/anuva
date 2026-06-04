import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTrialStartDate } from '../core/wellnessCalibration';
import { useAuth } from '../auth/auth-context';
import { assessmentPath } from './config/assessmentView';

const BENCHMARK_DAY_OFFSET = 7;
const CARE_PATH_DAY_OFFSET = 14;

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addCalendarDays(from: Date, days: number): Date {
  const d = startOfDay(from);
  d.setDate(d.getDate() + days);
  return d;
}

function formatBenchmarkDay(date: Date): string {
  const weekday = date.toLocaleDateString('en-IN', { weekday: 'short' });
  return `Next ${weekday}`;
}

/** Month + day, e.g. May 12 */
function formatCarePathDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildSevenDayPlan(trialStartedAt?: string) {
  const start = startOfDay(trialStartedAt ? new Date(trialStartedAt) : new Date());

  return [
    { phase: 'Today', action: 'ANU learns about you', eta: 'Today' },
    { phase: 'Days 2-6', action: 'Daily symptom tracking', eta: 'This week' },
    {
      phase: 'Day 7',
      action: 'Your first benchmark report',
      eta: formatBenchmarkDay(addCalendarDays(start, BENCHMARK_DAY_OFFSET)),
    },
    {
      phase: 'Week 2',
      action: 'Matched care path unlocks',
      eta: formatCarePathDate(addCalendarDays(start, CARE_PATH_DAY_OFFSET)),
    },
  ];
}

export default function AnuGreetingRoute() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pulse, setPulse] = useState(0);
  const sevenDayPlan = useMemo(() => buildSevenDayPlan(getTrialStartDate(user)), [user]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPulse((prev) => prev + 1);
    }, 1500);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user && !user.onboardingCompleted) {
      navigate(assessmentPath(), { replace: true });
    }
  }, [navigate, user]);

  return (
    <main className="relative min-h-mobile overflow-x-hidden overflow-y-auto bg-surface text-on-surface">
      <div
        className="pointer-events-none absolute left-1/2 top-[100px] h-[380px] w-[380px] -translate-x-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(206, 189, 255, 0.2) 0%, transparent 55%)' }}
      />

      <section className="relative z-10 flex flex-1 flex-col items-center px-6 pb-[22px] pt-5">
        <div
          className="mt-[22px] flex h-[130px] w-[130px] items-center justify-center rounded-full"
          style={{
            boxShadow: '0 0 0 1px rgba(206, 189, 255, 0.3), 0 0 50px rgba(206, 189, 255, 0.16), inset 0 0 50px rgba(206, 189, 255, 0.08)',
            transform: `scale(${1 + (pulse % 2) * 0.025})`,
            transition: 'transform 1.4s ease-in-out',
          }}
        >
          <img src="/anu.png" alt="ANU companion mark" className="h-[84px] w-[84px] object-contain" />
        </div>

        <p
          className="mt-[26px] text-[11px] uppercase tracking-[0.3em] text-primary"
          style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
        >
          Hello, I&apos;m ANU
        </p>

        <p
          className="font-display mt-[18px] px-2 text-center text-[22px] leading-[1.4] text-on-surface"
        >
          &quot;I&apos;ll be here every day — to listen, to learn what works for your body, and to quietly guide you toward rest.&quot;
        </p>
        <p className="mt-2.5 text-center text-[12px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          — ANU, your wellness companion
        </p>

        <article className="mt-[26px] w-full rounded-[20px] border border-border-default bg-surface-container-low p-[18px]">
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Next 7 days</span>
          </div>

          <div>
            {sevenDayPlan.map((item, index) => (
              <div
                key={item.phase}
                className="flex items-center gap-3 py-2"
                style={{ borderTop: index === 0 ? 'none' : '1px solid rgba(167, 139, 250, 0.2)' }}
              >
                <span
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px]"
                  style={{
                    background: index === 0 ? '#e2c62d' : 'transparent',
                    border: index === 0 ? 'none' : '1px solid rgba(148, 142, 157, 0.35)',
                    color: index === 0 ? '#322f37' : '#948e9d',
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                    fontWeight: 600,
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>

                <span className="flex-1">
                  <span className="block text-[13px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {item.action}
                  </span>
                  <span className="mt-0.5 block text-[10px] uppercase tracking-[0.08em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    {item.phase}
                  </span>
                </span>

                <span className="text-[10px] uppercase tracking-[0.08em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                  {item.eta}
                </span>
              </div>
            ))}
          </div>
        </article>

        <button
          type="button"
          onClick={() => navigate('/home')}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Begin with ANU
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" stroke="#322f37" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>
    </main>
  );
}
