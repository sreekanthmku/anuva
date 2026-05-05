import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';

type CategoryKey = 'vaso' | 'sleep' | 'mood' | 'life';

type Selections = Record<CategoryKey, string[]>;

const categories: { key: CategoryKey; label: string; items: [string, string][] }[] = [
  { key: 'vaso', label: 'Vasomotor', items: [['hot-flash', 'Hot flash'], ['night-sweat', 'Night sweat'], ['chills', 'Chills']] },
  { key: 'sleep', label: 'Sleep & Energy', items: [['slept-well', 'Slept well'], ['interrupted', 'Interrupted'], ['fatigued', 'Fatigued']] },
  { key: 'mood', label: 'Emotional', items: [['anxious', 'Anxious'], ['calm', 'Calm'], ['irritable', 'Irritable']] },
  { key: 'life', label: 'Lifestyle', items: [['walked', '30min walk'], ['caffeine', 'Caffeine'], ['alcohol', 'Alcohol']] },
];

const days = ['T', 'W', 'T', 'F', 'S', 'S', 'M'];
const loggedDayIndices = [0, 1, 2, 3, 4, 5];
const todayIndex = 6;

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
  const navigate = useNavigate();
  const [selections, setSelections] = useState<Selections>(initialSelections);
  const [intensity, setIntensity] = useState(4);

  const toggle = (cat: CategoryKey, id: string) => {
    setSelections((prev) => {
      const list = prev[cat];
      const has = list.includes(id);
      return { ...prev, [cat]: has ? list.filter((x) => x !== id) : [...list, id] };
    });
  };

  return (
    <main className="min-h-mobile overflow-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow colorClass="text-primary">Day 8 · Week 2</Eyebrow>
          <h1
            className="mb-[18px] text-[30px] leading-[1.05] text-on-surface"
            style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 400, fontVariationSettings: '"opsz" 144' }}
          >
            How was your{' '}
            <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
              today
            </em>
            , Priya?
          </h1>

          <div className="flex justify-between gap-1.5">
            {days.map((d, i) => {
              const isLogged = loggedDayIndices.includes(i);
              const isToday = i === todayIndex;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[9.5px] tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    {d}
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
                      fontSize: 11,
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
              style={{ fontFamily: '"Fraunces Variable", "Fraunces", Georgia, serif', fontWeight: 600, fontVariationSettings: '"opsz" 96' }}
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
