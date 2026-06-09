import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';

type CategoryKey = 'vaso' | 'sleep' | 'mood' | 'life';

type Selections = Record<CategoryKey, string[]>;

const categories: { key: CategoryKey; label: string; items: [string, string][] }[] = [
  { key: 'vaso', label: 'Vasomotor', items: [['hot-flash', 'Hot flash'], ['night-sweat', 'Night sweat'], ['chills', 'Chills']] },
  { key: 'sleep', label: 'Sleep & Energy', items: [['slept-well', 'Slept well'], ['interrupted', 'Interrupted'], ['fatigued', 'Fatigued']] },
  { key: 'mood', label: 'Emotional', items: [['anxious', 'Anxious'], ['calm', 'Calm'], ['irritable', 'Irritable']] },
  { key: 'life', label: 'Lifestyle', items: [['walked', '30min walk'], ['caffeine', 'Caffeine'], ['alcohol', 'Alcohol']] },
];

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

type WeekDayCell = {
  label: (typeof WEEKDAY_LABELS)[number];
  dateNum: number;
  isToday: boolean;
};

function getCurrentWeekDays(reference = new Date()): WeekDayCell[] {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return WEEKDAY_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    return {
      label,
      dateNum: date.getDate(),
      isToday: date.getTime() === today.getTime(),
    };
  });
}

const initialSelections: Selections = {
  vaso: ['hot-flash'],
  sleep: ['interrupted'],
  mood: [],
  life: ['caffeine'],
};

function Eyebrow({ children, colorClass = 'text-outline' }: { children: ReactNode; colorClass?: string }) {
  return (
    <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${colorClass}`}>
      <span className={`h-px w-3 ${colorClass === 'text-primary' ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{children}</span>
    </div>
  );
}

export default function SymptomTrackRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selections, setSelections] = useState<Selections>(initialSelections);
  const [intensity, setIntensity] = useState(4);
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const weekDays = useMemo(() => getCurrentWeekDays(), []);
  const todayIndex = weekDays.findIndex((d) => d.isToday);
  const loggedDayIndices = weekDays.map((_, i) => i).filter((i) => i < todayIndex);

  const toggle = (cat: CategoryKey, id: string) => {
    setSelections((prev) => {
      const list = prev[cat];
      const has = list.includes(id);
      return { ...prev, [cat]: has ? list.filter((x) => x !== id) : [...list, id] };
    });
  };

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow colorClass="text-primary">Day 8 · Week 2</Eyebrow>
          <h1
            className="font-display mb-[18px] text-[30px] leading-[1.05] text-on-surface"
          >
            How was your{' '}
            <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
              today
            </em>
            {`, ${firstName}?`}
          </h1>

          <div className="flex justify-between gap-1">
            {weekDays.map((day, i) => {
              const isLogged = loggedDayIndices.includes(i);
              const isToday = day.isToday;
              return (
                <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[9px] uppercase tracking-[0.08em] ${isToday ? 'text-primary' : 'text-outline'}`}
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                  >
                    {day.label}
                  </span>
                  <span
                    className={`text-[11px] leading-none ${isToday ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                  >
                    {day.dateNum}
                  </span>
                  <div
                    className="flex items-center justify-center font-semibold"
                    style={{
                      width: isToday ? '100%' : 10,
                      height: isToday ? 28 : 10,
                      borderRadius: isToday ? 14 : '50%',
                      background: isToday ? '#e2c62d' : isLogged ? '#cebdff' : '#2b2930',
                      color: isToday ? '#322f37' : '#e6e0ea',
                      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
                      fontSize: isToday ? 10 : 11,
                    }}
                  >
                    {isToday ? 'Today' : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-[18px] px-[22px] pb-[22px] pt-[14px]">
        {categories.map((cat) => (
          <div key={cat.key}>
            <Eyebrow>{cat.label}</Eyebrow>
            <div className="grid grid-cols-3 gap-2">
              {cat.items.map(([id, label]) => {
                const sel = selections[cat.key].includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggle(cat.key, id)}
                    className="rounded-starchart-lg border px-2 py-3 text-center text-[12px] font-medium transition-colors"
                    style={{
                      backgroundColor: sel ? '#2E2A6E' : '#141219',
                      borderColor: sel ? '#cebdff' : 'rgba(167, 139, 250, 0.2)',
                      color: sel ? '#cebdff' : '#e6e0ea',
                      fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <Eyebrow>Overall intensity</Eyebrow>
            <span
              className="text-[22px] text-on-surface"
            >
              {intensity}
              <span className="text-[14px] font-normal text-outline">/7</span>
            </span>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 7 }).map((_, i) => {
              const filled = i < intensity;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIntensity(i + 1)}
                  className="h-2.5 flex-1 rounded-full border-none p-0"
                  style={{
                    background: filled ? 'linear-gradient(90deg, #cebdff, #F87171)' : '#2b2930',
                    cursor: 'pointer',
                  }}
                  aria-label={`Intensity ${i + 1}`}
                />
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between">
            <span className="text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Gentle day
            </span>
            <span className="text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Difficult day
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/report')}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif', letterSpacing: '-0.005em' }}
        >
          Save Log ✓
        </button>
      </div>

      <BottomNav />
    </main>
  );
}
