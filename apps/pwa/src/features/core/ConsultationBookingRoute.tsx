import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';

type SpecialistId = 'gynec' | 'psych' | 'nutri';

const specialists: {
  id: SpecialistId;
  title: string;
  sub: string;
  tag?: string;
}[] = [
  { id: 'gynec', title: 'Gynaecologist', sub: 'Dr. Priya Nair · 18y', tag: 'Recommended' },
  { id: 'psych', title: 'Psychologist', sub: 'Dr. Anjali Mehta · 12y' },
  { id: 'nutri', title: 'Nutritionist', sub: 'Kavya Shenoy · 9y' },
];

function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DATES_PER_PAGE = 6;

/** 30-minute slots from 10:00 to 16:30 (last slot ends at 17:00). */
function consultationTimeSlots(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const startMin = 10 * 60;
  const endMin = 17 * 60;
  for (let t = startMin; t + 30 <= endMin; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const id = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const d = new Date(2000, 0, 1, h, m);
    const label = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    out.push({ id, label });
  }
  return out;
}

function dateSlotsFromTodayOffset(
  firstDayOffset: number,
  count: number,
): { id: string; dayNum: number; monthLabel: string; weekdayLabel: string }[] {
  const out: { id: string; dayNum: number; monthLabel: string; weekdayLabel: string }[] = [];
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + firstDayOffset);
  for (let i = 0; i < count; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    out.push({
      id: localYmd(d),
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString(undefined, { month: 'short' }),
      weekdayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return out;
}

function Eyebrow({ children, mint = false }: { children: string; mint?: boolean }) {
  return (
    <div
      className={`mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${mint ? 'text-primary' : 'text-outline'}`}
    >
      <span className={`h-px w-3 ${mint ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{children}</span>
    </div>
  );
}

function formatBookingDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ConsultationBookingRoute() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<'form' | 'confirmed'>('form');
  const [specialist, setSpecialist] = useState<SpecialistId>('gynec');
  const [datePageStartOffset, setDatePageStartOffset] = useState(0);
  const dateSlots = useMemo(
    () => dateSlotsFromTodayOffset(datePageStartOffset, DATES_PER_PAGE),
    [datePageStartOffset],
  );
  const timeSlots = useMemo(() => consultationTimeSlots(), []);
  const [pickedDateId, setPickedDateId] = useState<string | null>(null);
  const [pickedTimeId, setPickedTimeId] = useState<string | null>(null);

  const canGoPrevDates = datePageStartOffset > 0;

  function goPrevDatePage() {
    if (!canGoPrevDates) return;
    setDatePageStartOffset((o) => Math.max(0, o - DATES_PER_PAGE));
    setPickedDateId(null);
    setPickedTimeId(null);
  }

  function goNextDatePage() {
    setDatePageStartOffset((o) => o + DATES_PER_PAGE);
    setPickedDateId(null);
    setPickedTimeId(null);
  }

  function selectDate(id: string) {
    setPickedDateId(id);
    setPickedTimeId(null);
  }

  const specialistLabel = specialists.find((s) => s.id === specialist)?.title ?? '';
  const timeLabel = timeSlots.find((t) => t.id === pickedTimeId)?.label ?? '';

  function confirmBooking() {
    if (!pickedDateId || !pickedTimeId) return;
    setPhase('confirmed');
  }

  if (phase === 'confirmed' && pickedDateId && pickedTimeId) {
    return (
      <main className="min-h-mobile overflow-auto bg-surface pb-28 text-on-surface">
        <div className="flex flex-col items-center px-[22px] pb-6 pt-[max(1.25rem,env(safe-area-inset-top))] text-center">
          <Eyebrow mint>Confirmed</Eyebrow>
          <div
            className="mt-2 mb-5 flex h-[88px] w-[88px] items-center justify-center rounded-full border border-primary/30 bg-primary/10"
            style={{ boxShadow: '0 0 32px rgba(206, 189, 255, 0.15)' }}
          >
            <img src="/anu.png" alt="ANU" className="h-[72px] w-[72px] object-contain" />
          </div>
          <h1
            className="mb-2 max-w-[18rem] text-[26px] leading-[1.15] text-on-surface"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
          >
            Your consult is{' '}
            <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
              booked
            </em>
            .
          </h1>
          <p
            className="mb-6 max-w-[20rem] text-[13px] leading-[1.5] text-on-surface-variant"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            ANU saved your slot. You&apos;ll get a reminder before your video call.
          </p>

          <article
            className="w-full max-w-[20rem] rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space p-5 text-left"
            style={{ boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}
          >
            <div
              className="mb-3 text-[9.5px] uppercase tracking-[0.12em] text-primary"
              style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
            >
              Summary
            </div>
            <dl className="flex flex-col gap-4 text-[13px]" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              <div className="flex flex-col gap-0.5 border-b border-border-default pb-3">
                <dt className="text-[11px] text-outline">Specialist</dt>
                <dd className="font-medium text-on-surface">{specialistLabel}</dd>
              </div>
              <div className="flex flex-col gap-0.5 border-b border-border-default pb-3">
                <dt className="text-[11px] text-outline">Date</dt>
                <dd className="font-medium text-on-surface">{formatBookingDateLong(pickedDateId)}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-[11px] text-outline">Time</dt>
                <dd className="font-medium text-on-surface">{timeLabel}</dd>
              </div>
            </dl>
          </article>

          <button
            type="button"
            onClick={() => navigate('/home')}
            className="mt-8 inline-flex w-full max-w-[20rem] items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
          >
            Back to home
          </button>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-mobile overflow-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))] shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div
          className="mb-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
          style={{
            backgroundColor: 'rgba(206, 189, 255, 0.16)',
            borderColor: 'rgba(206, 189, 255, 0.3)',
          }}
        >
          <span className="text-[9.5px] uppercase tracking-[0.15em] text-primary" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            ★ Included free · first consult
          </span>
        </div>
        <h1
          className="mb-1.5 max-w-[22rem] text-[28px] leading-[1.15] text-on-surface"
          style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
        >
          Book with a{' '}
          <em className="not-italic text-primary" style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontStyle: 'italic' }}>
            specialist
          </em>
        </h1>
        <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
          30-minute video call · reschedule anytime
        </p>
      </header>

      <section className="px-[22px]">
        <Eyebrow>Choose specialist</Eyebrow>
        <div className="flex flex-col gap-2">
          {specialists.map((s) => {
            const sel = specialist === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSpecialist(s.id)}
                className="flex items-center gap-3.5 rounded-starchart-lg border p-3.5 text-left transition-colors"
                style={{
                  backgroundColor: sel ? '#2E2A6E' : '#141219',
                  borderColor: sel ? '#cebdff' : 'rgba(167, 139, 250, 0.2)',
                }}
              >
                <div
                  className="h-11 w-11 shrink-0 rounded-full border border-border-default"
                  style={{
                    background:
                      'repeating-linear-gradient(135deg, #1d1a21 0 4px, #2b2930 4px 8px)',
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-base font-medium text-on-surface"
                      style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif' }}
                    >
                      {s.title}
                    </span>
                    {s.tag && (
                      <span
                        className="rounded-full border px-[7px] py-0.5 text-[8.5px] uppercase tracking-[0.15em] text-primary"
                        style={{
                          fontFamily: '"Geist Mono", ui-monospace, monospace',
                          backgroundColor: 'rgba(206, 189, 255, 0.16)',
                          borderColor: 'rgba(206, 189, 255, 0.3)',
                        }}
                      >
                        {s.tag}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    {s.sub}
                  </div>
                </div>
                {sel && (
                  <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-primary">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M5 12l5 5L20 7" stroke="#322f37" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-[22px] pt-[18px]">
        <Eyebrow>Choose a date</Eyebrow>
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={goPrevDatePage}
            disabled={!canGoPrevDates}
            aria-label="Previous dates"
            className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-full border border-border-default bg-surface-container-low px-3 py-2 text-[12px] font-medium text-on-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Earlier
          </button>
          <button
            type="button"
            onClick={goNextDatePage}
            aria-label="Next dates"
            className="flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-full border border-border-default bg-surface-container-low px-3 py-2 text-[12px] font-medium text-on-surface transition-opacity"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Later
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {dateSlots.map((s) => {
            const sel = pickedDateId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => selectDate(s.id)}
                className="rounded-starchart-lg border px-2 py-2.5 text-center transition-colors"
                style={{
                  backgroundColor: sel ? '#e2c62d' : '#141219',
                  color: sel ? '#322f37' : '#e6e0ea',
                  borderColor: sel ? '#e2c62d' : 'rgba(167, 139, 250, 0.2)',
                }}
              >
                <div
                  className="text-[9.5px] uppercase tracking-[0.12em]"
                  style={{
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                    color: sel ? '#322f37' : '#948e9d',
                    opacity: sel ? 0.7 : 1,
                  }}
                >
                  {s.monthLabel}
                </div>
                <div
                  className="mt-0.5 text-[22px] font-semibold tabular-nums"
                  style={{
                    fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif',
                    fontVariationSettings: '"opsz" 96',
                    color: sel ? '#322f37' : '#e6e0ea',
                  }}
                >
                  {s.dayNum}
                </div>
                <div
                  className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em]"
                  style={{
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                    color: sel ? '#322f37' : '#948e9d',
                    opacity: sel ? 0.7 : 1,
                  }}
                >
                  {s.weekdayLabel}
                </div>
              </button>
            );
          })}
        </div>

        {pickedDateId && (
          <div className="mt-4">
            <Eyebrow>Choose a time</Eyebrow>
            <p className="mb-2 text-[11px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              10:00 AM – 5:00 PM · 30-minute slots
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {timeSlots.map((t) => {
                const sel = pickedTimeId === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPickedTimeId(t.id)}
                    className="rounded-starchart-lg border px-2 py-2.5 text-center transition-colors"
                    style={{
                      backgroundColor: sel ? '#e2c62d' : '#141219',
                      color: sel ? '#322f37' : '#e6e0ea',
                      borderColor: sel ? '#e2c62d' : 'rgba(167, 139, 250, 0.2)',
                    }}
                  >
                    <span className="text-[13px] font-medium tabular-nums" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="px-[22px] py-5">
        <button
          type="button"
          disabled={!pickedDateId || !pickedTimeId}
          onClick={confirmBooking}
          className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Confirm Booking
        </button>
        <p
          className="mt-3 text-center text-[10.5px] leading-[1.5] text-outline"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
        >
          Your name is not shared until the call begins. You may leave at any time.
        </p>
      </section>

      <BottomNav />
    </main>
  );
}
