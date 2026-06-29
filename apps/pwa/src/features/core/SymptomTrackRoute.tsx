import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  MoodEmotion,
  NudgeDayTracker,
  NudgeTier,
  SleepDisruption,
  SleepHoursBucket,
} from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { MoodLogSheet } from './components/MoodLogSheet';
import { SleepLogSheet } from './components/SleepLogSheet';
import { useNudgeDay } from './hooks/useNudgeDay';
import { useMoodLog } from './hooks/useMoodLog';
import { useSleepLog } from './hooks/useSleepLog';

// Mood (L1-003) + sleep (L1-001) keep the emoji scale + extras via these sheets.
const EMOJI_TRACKERS = new Set(['L1-001', 'L1-003']);

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

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

const TIERS: { key: NudgeTier; label: string }[] = [
  { key: 'core', label: 'Daily core' },
  { key: 'body', label: 'Body' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'weekly', label: 'This week' },
];

function OptionChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="rounded-full border px-3.5 py-2 text-[12px] font-medium transition-colors outline-none focus:outline-none disabled:opacity-50"
      style={{
        backgroundColor: selected ? '#5E3566' : '#FFFFFF',
        borderColor: selected ? '#5E3566' : 'rgba(94, 53, 102, 0.18)',
        color: selected ? '#FBF6F0' : '#3E2542',
        fontFamily: FONT_BODY,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {label}
    </button>
  );
}

export default function SymptomTrackRoute() {
  const { user } = useAuth();
  const { data, loading, error, respond, reload } = useNudgeDay();
  const moodLog = useMoodLog();
  const sleepLog = useSleepLog();

  // Optimistic answer overlay + per-tracker saving + manual re-open editing.
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [openTiers, setOpenTiers] = useState<Set<NudgeTier>>(new Set(['core']));
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepSaving, setSleepSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const todayMood = moodLog.data?.today ?? null;
  const todaySleep = sleepLog.data?.today ?? null;

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setMoodSaving(true);
    try {
      await moodLog.logMood(feeling, emotions);
      await reload();
    } finally {
      setMoodSaving(false);
    }
  };

  const handleLogSleep = async (
    quality: number,
    hours: SleepHoursBucket | null,
    disruptions: SleepDisruption[]
  ) => {
    setSleepSaving(true);
    try {
      await sleepLog.logSleep(quality, hours, disruptions);
      await reload();
    } finally {
      setSleepSaving(false);
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const weekDays = useMemo(() => getCurrentWeekDays(), []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  const trackers = data?.trackers ?? [];
  const answerOf = (t: NudgeDayTracker): string | null => localAnswers[t.nudgeId] ?? t.answer;
  const isAnswered = (t: NudgeDayTracker): boolean => answerOf(t) !== null;

  const answeredCount = trackers.filter(isAnswered).length;
  const total = trackers.length;
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  const submit = async (t: NudgeDayTracker, answer: string) => {
    setSaving(t.nudgeId);
    setLocalAnswers((prev) => ({ ...prev, [t.nudgeId]: answer }));
    setEditing((prev) => {
      const next = new Set(prev);
      next.delete(t.nudgeId);
      return next;
    });
    try {
      const res = await respond({ nudgeId: t.nudgeId, answer });
      showToast(res.message);
    } catch {
      showToast("Couldn't save that — we'll retry later.");
    } finally {
      setSaving(null);
    }
  };

  const toggleTier = (tier: NudgeTier) =>
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });

  const toggleEdit = (id: string) =>
    setEditing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border-default bg-primary-container shadow-[0_10px_24px_rgba(94,53,102,0.06)]">
        <div className="px-3 pb-[20px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow>{loading ? 'Loading…' : `${answeredCount} of ${total} logged today`}</Eyebrow>
          <h1 className="font-display mb-[16px] text-[30px] leading-[1.05] text-on-surface">
            How was your{' '}
            <em className="not-italic text-primary" style={{ fontWeight: 300 }}>
              today
            </em>
            {`, ${firstName}?`}
          </h1>

          {/* Progress bar */}
          <div className="mb-[16px] h-2 w-full overflow-hidden rounded-full bg-surface-bright">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

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
                      background: isToday ? '#5E3566' : '#FFFFFF',
                      color: isToday ? '#FBF6F0' : '#3E2542',
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

      <div className="flex flex-col gap-3 px-3 pb-[22px] pt-[18px]">
        {error && (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-3 text-[13px] text-on-surface-variant">
            {error}{' '}
            <button type="button" onClick={reload} className="text-primary underline">
              Retry
            </button>
          </div>
        )}

        {TIERS.map((tier) => {
          const items = trackers.filter((t) => t.tier === tier.key);
          if (items.length === 0) return null;
          const open = openTiers.has(tier.key);
          const tierAnswered = items.filter(isAnswered).length;

          return (
            <section
              key={tier.key}
              className={`overflow-hidden rounded-[20px] border border-border-default ${
                open
                  ? 'bg-surface-raised shadow-[0_14px_32px_rgba(94,53,102,0.08)]'
                  : 'bg-secondary-container'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTier(tier.key)}
                className={`flex w-full items-center justify-between px-4 py-3.5 text-left ${
                  open ? 'bg-primary-container' : ''
                }`}
              >
                <span
                  className="text-[14px] font-medium text-on-surface"
                  style={{ fontFamily: FONT_BODY }}
                >
                  {tier.label}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    open ? 'bg-surface-bright text-outline' : 'bg-surface-bright text-primary'
                  }`}
                  style={{ fontFamily: FONT_MONO }}
                >
                  {tierAnswered}/{items.length} {open ? '▾' : '▸'}
                </span>
              </button>

              {open && (
                <div className="flex flex-col gap-4 border-t border-primary/10 px-4 py-4">
                  {items.map((t) => {
                    // Mood & sleep keep the emoji scale + extras via their sheets.
                    if (EMOJI_TRACKERS.has(t.nudgeId)) {
                      const answered = t.answer !== null;
                      const openSheet = () =>
                        t.nudgeId === 'L1-003' ? setMoodOpen(true) : setSleepOpen(true);
                      return (
                        <div key={t.nudgeId} className="flex items-center justify-between gap-2">
                          <div>
                            <span
                              className="text-[13px] text-on-surface"
                              style={{ fontFamily: FONT_BODY }}
                            >
                              {t.label}
                              {answered && <span className="ml-1.5 text-primary">✓</span>}
                            </span>
                            <p
                              className="text-[12px] text-on-surface-variant"
                              style={{ fontFamily: FONT_BODY }}
                            >
                              {answered ? t.answer : 'Not logged yet'}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={openSheet}
                            className="rounded-full border border-border-default px-3.5 py-1.5 text-[12px] text-on-surface"
                            style={{ fontFamily: FONT_BODY }}
                          >
                            {answered ? 'Change' : 'Log'}
                          </button>
                        </div>
                      );
                    }

                    const answer = answerOf(t);
                    const answered = answer !== null;
                    const showOptions = !answered || editing.has(t.nudgeId);
                    return (
                      <div key={t.nudgeId}>
                        <div className="mb-2 flex items-baseline justify-between gap-2">
                          <span
                            className="text-[13px] text-on-surface"
                            style={{ fontFamily: FONT_BODY }}
                          >
                            {t.label}
                            {answered && <span className="ml-1.5 text-primary">✓</span>}
                          </span>
                          {answered && !showOptions && (
                            <button
                              type="button"
                              onClick={() => toggleEdit(t.nudgeId)}
                              className="text-[10px] uppercase tracking-[0.1em] text-outline"
                              style={{ fontFamily: FONT_MONO }}
                            >
                              Change
                            </button>
                          )}
                        </div>

                        {showOptions ? (
                          <div className="flex flex-wrap gap-2">
                            {t.options.map((opt) => (
                              <OptionChip
                                key={opt}
                                label={opt}
                                selected={answer === opt}
                                disabled={saving === t.nudgeId}
                                onClick={() => submit(t, opt)}
                              />
                            ))}
                          </div>
                        ) : (
                          <p
                            className="text-[13px] text-on-surface-variant"
                            style={{ fontFamily: FONT_BODY }}
                          >
                            {answer}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+16px)] z-[80] flex justify-center px-4">
          <div
            className="max-w-[340px] rounded-full border border-border-default bg-surface-raised px-4 py-2.5 text-[12px] text-on-surface"
            style={{ fontFamily: FONT_BODY }}
            role="status"
          >
            {toast}
          </div>
        </div>
      )}

      <MoodLogSheet
        open={moodOpen}
        initialFeeling={todayMood?.feeling ?? null}
        initialEmotions={todayMood?.emotions ?? []}
        saving={moodSaving}
        onClose={() => setMoodOpen(false)}
        onSave={handleLogMood}
      />

      <SleepLogSheet
        open={sleepOpen}
        initialQuality={todaySleep?.quality ?? null}
        initialHours={todaySleep?.hours ?? null}
        initialDisruptions={todaySleep?.disruptions ?? []}
        saving={sleepSaving}
        onClose={() => setSleepOpen(false)}
        onSave={handleLogSleep}
      />

      <BottomNav />
    </main>
  );
}
