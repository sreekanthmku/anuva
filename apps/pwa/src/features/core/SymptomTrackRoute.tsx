import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { TRACK_DOMAINS } from './data/trackSymptoms';

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

const FEELINGS: { value: number; label: string; icon: LucideIcon; color: string }[] = [
  { value: 5, label: 'Great', icon: Laugh, color: '#6ee7b7' },
  { value: 4, label: 'Good', icon: Smile, color: '#a7f3d0' },
  { value: 3, label: 'Okay', icon: Meh, color: '#dbc839' },
  { value: 2, label: 'Low', icon: Frown, color: '#fb923c' },
  { value: 1, label: 'Awful', icon: Annoyed, color: '#F87171' },
];

const MOOD_EMOTIONS: [string, string][] = [
  ['calm', 'Calm'],
  ['energized', 'Energized'],
  ['anxious', 'Anxious'],
  ['irritable', 'Irritable'],
  ['sad', 'Sad'],
  ['tearful', 'Tearful'],
  ['foggy', 'Foggy'],
  ['overwhelmed', 'Overwhelmed'],
];

const SLEEP_HOURS: [string, string][] = [
  ['lt5', '<5h'],
  ['5to6', '5–6h'],
  ['6to7', '6–7h'],
  ['7to8', '7–8h'],
  ['gt8', '8+h'],
];

const SLEEP_DISRUPTIONS: [string, string][] = [
  ['night_sweats', 'Night sweats'],
  ['hot_flashes', 'Hot flashes'],
  ['cant_fall_asleep', "Couldn't fall asleep"],
  ['woke_often', 'Woke often'],
  ['woke_early', 'Woke too early'],
  ['bathroom_trips', 'Bathroom trips'],
  ['racing_mind', 'Racing mind'],
  ['restless', 'Restless'],
];

const FONT_BODY = '"Geist", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", ui-monospace, monospace';

function Eyebrow({ children, colorClass = 'text-outline' }: { children: ReactNode; colorClass?: string }) {
  return (
    <div className={`mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] ${colorClass}`}>
      <span className={`h-px w-3 ${colorClass === 'text-primary' ? 'bg-primary/60' : 'bg-outline/60'}`} />
      <span style={{ fontFamily: FONT_MONO }}>{children}</span>
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className="rounded-full border px-3.5 py-2 text-[12px] font-medium transition-colors outline-none focus:outline-none focus-visible:outline-none"
      style={{
        backgroundColor: selected ? '#cebdff' : 'transparent',
        borderColor: selected ? '#cebdff' : 'rgba(148, 142, 157, 0.35)',
        color: selected ? '#322f37' : '#e6e0ea',
        fontFamily: FONT_BODY,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

function FaceScale({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {FEELINGS.map((f) => {
        const Icon = f.icon;
        const selected = value === f.value;
        return (
          <button
            key={f.value}
            type="button"
            onClick={() => onChange(f.value)}
            aria-pressed={selected}
            className="flex flex-col items-center gap-1.5 rounded-[16px] bg-transparent px-1 py-2 outline-none transition-transform focus:outline-none focus-visible:outline-none"
            style={{ transform: selected ? 'scale(1.18)' : 'scale(1)', WebkitTapHighlightColor: 'transparent' }}
          >
            <Icon size={30} strokeWidth={1.5} fill={f.color} style={{ color: '#322f37' }} />
            <span
              className={`text-[9px] uppercase tracking-[0.04em] ${selected ? 'text-on-surface' : 'text-outline'}`}
              style={{ fontFamily: FONT_MONO }}
            >
              {f.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function SymptomTrackRoute() {
  const { user } = useAuth();
  const [feeling, setFeeling] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<Set<string>>(new Set());
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [sleepHours, setSleepHours] = useState<string | null>(null);
  const [disruptions, setDisruptions] = useState<Set<string>>(new Set());
  const [symptoms, setSymptoms] = useState<Set<string>>(new Set());
  const [intensity, setIntensity] = useState(4);
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const weekDays = useMemo(() => getCurrentWeekDays(), []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const toggleIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (id: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleEmotion = toggleIn(setEmotions);
  const toggleDisruption = toggleIn(setDisruptions);
  const toggleSymptom = toggleIn(setSymptoms);

  const handleSave = () => {
    // Local only for now — persistence lands in the backend pass.
    showToast('Check-in saved');
  };

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 bg-surface shadow-[0_1px_0_0_rgba(167,139,250,0.2)]">
        <div className="px-[22px] pb-[18px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow colorClass="text-primary">Day 8 · Week 2</Eyebrow>
          <h1 className="font-display mb-[18px] text-[30px] leading-[1.05] text-on-surface">
            How was your{' '}
            <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
              today
            </em>
            {`, ${firstName}?`}
          </h1>

          <div className="flex justify-between gap-1">
            {weekDays.map((day) => {
              const isToday = day.isToday;
              return (
                <div key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[9px] uppercase tracking-[0.08em] ${isToday ? 'text-primary' : 'text-outline'}`}
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {day.label}
                  </span>
                  <span
                    className={`text-[11px] leading-none ${isToday ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {day.dateNum}
                  </span>
                  <div
                    className="flex items-center justify-center font-semibold"
                    style={{
                      width: isToday ? '100%' : 10,
                      height: isToday ? 28 : 10,
                      borderRadius: isToday ? 14 : '50%',
                      background: isToday ? '#e2c62d' : '#2b2930',
                      color: isToday ? '#322f37' : '#e6e0ea',
                      fontFamily: FONT_BODY,
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

      <div className="flex flex-col gap-[22px] px-[22px] pb-[22px] pt-[16px]">
        {/* Mood */}
        <section>
          <Eyebrow colorClass="text-primary">Mood</Eyebrow>
          <FaceScale value={feeling} onChange={setFeeling} />
          {feeling !== null && (
            <div className="mt-3 flex flex-wrap gap-2">
              {MOOD_EMOTIONS.map(([id, label]) => (
                <Chip key={id} label={label} selected={emotions.has(id)} onClick={() => toggleEmotion(id)} />
              ))}
            </div>
          )}
        </section>

        {/* Sleep */}
        <section>
          <Eyebrow colorClass="text-primary">Sleep</Eyebrow>
          <FaceScale value={sleepQuality} onChange={setSleepQuality} />
          {sleepQuality !== null && (
            <>
              <p className="mb-2 mt-3 text-[11px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
                Hours slept
              </p>
              <div className="flex flex-wrap gap-2">
                {SLEEP_HOURS.map(([id, label]) => (
                  <Chip
                    key={id}
                    label={label}
                    selected={sleepHours === id}
                    onClick={() => setSleepHours((cur) => (cur === id ? null : id))}
                  />
                ))}
              </div>
              <p className="mb-2 mt-3 text-[11px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
                What disrupted it?
              </p>
              <div className="flex flex-wrap gap-2">
                {SLEEP_DISRUPTIONS.map(([id, label]) => (
                  <Chip key={id} label={label} selected={disruptions.has(id)} onClick={() => toggleDisruption(id)} />
                ))}
              </div>
            </>
          )}
        </section>

        {/* Symptom domains */}
        {TRACK_DOMAINS.map((domain) => (
          <section key={domain.key}>
            <Eyebrow>{domain.label}</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {domain.items.map(([id, label]) => (
                <Chip key={id} label={label} selected={symptoms.has(id)} onClick={() => toggleSymptom(id)} />
              ))}
            </div>
          </section>
        ))}

        {/* Overall intensity */}
        <section>
          <div className="mb-2.5 flex items-baseline justify-between">
            <Eyebrow>Overall intensity</Eyebrow>
            <span className="text-[22px] text-on-surface">
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
            <span className="text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: FONT_MONO }}>
              Gentle day
            </span>
            <span className="text-[9.5px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: FONT_MONO }}>
              Difficult day
            </span>
          </div>
        </section>

        {/* Note */}
        <section>
          <Eyebrow>Note</Eyebrow>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Anything else you want to remember about today?"
            className="w-full resize-none rounded-starchart-lg border border-border-default bg-surface-container-low px-3.5 py-3 text-[13px] leading-[1.5] text-on-surface outline-none placeholder:text-outline focus:border-primary/50"
            style={{ fontFamily: FONT_BODY }}
          />
        </section>

        <button
          type="button"
          onClick={handleSave}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
          style={{ fontFamily: FONT_BODY, letterSpacing: '-0.005em' }}
        >
          Save Log ✓
        </button>
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+16px)] z-[80] flex justify-center px-4">
          <div
            className="max-w-[340px] rounded-full border border-border-default bg-surface-raised px-4 py-2.5 text-[12px] text-on-surface shadow-xl"
            style={{ fontFamily: FONT_BODY }}
            role="status"
          >
            {toast}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  );
}
