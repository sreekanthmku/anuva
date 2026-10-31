import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  LogJointBody,
  MoodEmotion,
  NudgeDayTracker,
  NudgeTier,
  SleepDisruption,
  SleepHoursBucket,
} from '@anuva/shared';
import { Trans, useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { useAuth } from '../auth/auth-context';
import { announce } from '../../lib/a11y/announce';
import { BottomNav } from './components/BottomNav';
import { MoodLogSheet } from './components/MoodLogSheet';
import { SleepLogSheet } from './components/SleepLogSheet';
import { JointsLogSheet } from './components/JointsLogSheet';
import { useNudgeDay } from './hooks/useNudgeDay';
import { useMoodLog } from './hooks/useMoodLog';
import { useSleepLog } from './hooks/useSleepLog';
import { useJointLog } from './hooks/useJointLog';
import { isSameLocalDay, localYmd, yesterdayAt, type TrackingDay } from './hooks/trackingDay';

// Mood (L1-003) + sleep (L1-001) keep the emoji scale + extras via these sheets.
const EMOJI_TRACKERS = new Set(['L1-001', 'L1-003']);

/**
 * Joints & Stiffness has no nudge behind it, so it is absent from the day sheet
 * and injected into the Body section here — directly after hot flashes, which is
 * the ordering the spec asks for.
 */
const JOINTS_AFTER_TRACKER = 'L1-005';

/** Monday-first, as keys. The shown text is `track.weekdays.<key>`. */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

type WeekDayCell = {
  key: (typeof WEEKDAY_KEYS)[number];
  dateNum: number;
  isToday: boolean;
  isYesterday: boolean;
};

function getCurrentWeekDays(reference = new Date()): WeekDayCell[] {
  const today = new Date(reference);
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysFromMonday);

  return WEEKDAY_KEYS.map((key, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return {
      key,
      dateNum: date.getDate(),
      isToday: date.getTime() === today.getTime(),
      isYesterday: date.getTime() === yesterday.getTime(),
    };
  });
}

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

/** Section order. Each tier's heading is `track.tiers.<key>`. */
const TIERS: NudgeTier[] = ['core', 'body', 'lifestyle', 'weekly'];

/** One answer of a tracker's scale: picking one answers the question, so it is a radio, not a toggle. */
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
      role="radio"
      aria-checked={selected}
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

/** The tick after a logged tracker's name, said as a word rather than as a symbol. */
function LoggedTick() {
  const { t } = useTranslation();
  return (
    <>
      <span aria-hidden="true" className="ml-1.5 text-primary">
        ✓
      </span>
      <span className="sr-only">{`, ${t('quickLogDialog.logged')}`}</span>
    </>
  );
}

export default function SymptomTrackRoute() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Today, or yesterday — the one day back she may still fill in. The "you missed yesterday" push
  // opens this screen with `?day=yesterday`.
  const [searchParams] = useSearchParams();
  const [day, setDay] = useState<TrackingDay>(
    searchParams.get('day') === 'yesterday' ? 'yesterday' : 'today'
  );
  const { data, loading, error, respond, reload } = useNudgeDay(day);
  const moodLog = useMoodLog();
  const sleepLog = useSleepLog();
  const jointLog = useJointLog();

  // Optimistic answer overlay + per-tracker saving + manual re-open editing.
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Set<string>>(new Set());
  const [openTiers, setOpenTiers] = useState<Set<NudgeTier>>(new Set(['core']));
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepSaving, setSleepSaving] = useState(false);
  const [jointsOpen, setJointsOpen] = useState(false);
  const [jointsSaving, setJointsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  const rowId = useId();
  // Answering folds a tracker's options away, taking the tapped one with them; focus lands on
  // that tracker's "Change" button instead of falling back to the top of the page.
  const focusChangeFor = useRef<string | null>(null);

  useEffect(() => {
    const id = focusChangeFor.current;
    if (!id) return;
    focusChangeFor.current = null;
    document.getElementById(`${rowId}-${id}-change`)?.focus({ preventScroll: true });
  });

  // The selected day's entries. Yesterday's come from the recent lists, which reach back 14 days.
  const yesterday = useMemo(() => yesterdayAt(), []);
  const todayMood =
    day === 'today'
      ? (moodLog.data?.today ?? null)
      : (moodLog.data?.recent.find(
          (entry) => entry.feeling != null && isSameLocalDay(entry.loggedAt, yesterday)
        ) ?? null);
  const todaySleep =
    day === 'today'
      ? (sleepLog.data?.today ?? null)
      : (sleepLog.data?.recent.find(
          (entry) => entry.quality != null && isSameLocalDay(entry.loggedAt, yesterday)
        ) ?? null);
  const todayJoints =
    day === 'today'
      ? (jointLog.data?.today ?? null)
      : (jointLog.data?.recent.find((entry) => entry.date === localYmd(yesterday)) ?? null);

  const switchDay = (next: TrackingDay) => {
    if (next === day) return;
    setDay(next);
    // Answers and open editors belong to the day they were given on.
    setLocalAnswers({});
    setEditing(new Set());
  };

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setMoodSaving(true);
    try {
      await moodLog.logMood(feeling, emotions, day);
      announce(t('a11y.tracking.moodSaved'));
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
      await sleepLog.logSleep(quality, hours, disruptions, day);
      announce(t('a11y.tracking.sleepSaved'));
      await reload();
    } finally {
      setSleepSaving(false);
    }
  };

  const handleLogJoints = async (body: LogJointBody) => {
    setJointsSaving(true);
    try {
      const entry = await jointLog.logJoints(
        day === 'yesterday' ? { ...body, date: localYmd(yesterday) } : body
      );
      showToast(
        entry.severity === 'none'
          ? t(day === 'yesterday' ? 'track.jointsNoneYesterday' : 'track.jointsNone')
          : t('track.jointsLogged')
      );
    } catch {
      showToast(t('track.saveFailed'));
    } finally {
      setJointsSaving(false);
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || t('home.nameFallback');
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
  // Renamed off `t` — that is the translator now.
  const answerOf = (tracker: NudgeDayTracker): string | null =>
    localAnswers[tracker.nudgeId] ?? tracker.answer;
  const isAnswered = (tracker: NudgeDayTracker): boolean => answerOf(tracker) !== null;

  // Joints is one more thing to log on this page, so it counts here — the day
  // sheet's own totals cannot include it, since no nudge backs it.
  const jointsAnswered = todayJoints !== null;
  const answeredCount = trackers.filter(isAnswered).length + (jointsAnswered ? 1 : 0);
  const total = trackers.length + (jointLog.loading ? 0 : 1);
  const pct = total ? Math.round((answeredCount / total) * 100) : 0;

  const submit = async (tracker: NudgeDayTracker, answer: string) => {
    setSaving(tracker.nudgeId);
    setLocalAnswers((prev) => ({ ...prev, [tracker.nudgeId]: answer }));
    focusChangeFor.current = tracker.nudgeId;
    setEditing((prev) => {
      const next = new Set(prev);
      next.delete(tracker.nudgeId);
      return next;
    });
    try {
      const res = await respond({ nudgeId: tracker.nudgeId, answer });
      showToast(res.message);
    } catch {
      showToast(t('track.saveFailed'));
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

  /**
   * The Joints & Stiffness row. Same shape as the mood and sleep rows — a
   * summary line plus Log/Change — because it opens a sheet rather than
   * answering inline.
   */
  const jointsCard = (
    <div key="joints" className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <span id={`${rowId}-joints-label`} className="text-[13px] text-on-surface" style={{ fontFamily: FONT_BODY }}>
          {t('track.joints')}
          {jointsAnswered && <LoggedTick />}
        </span>
        <p className="text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
          {todayJoints ? todayJoints.summary : t('track.notLoggedYet')}
        </p>
      </div>
      <button
        type="button"
        id={`${rowId}-joints-button`}
        aria-labelledby={`${rowId}-joints-button ${rowId}-joints-label`}
        onClick={() => setJointsOpen(true)}
        className="shrink-0 rounded-full border border-border-default px-3.5 py-1.5 text-[12px] text-on-surface"
        style={{ fontFamily: FONT_BODY }}
      >
        {jointsAnswered ? t('track.change') : t('track.log')}
      </button>
    </div>
  );

  /** One nudge-backed tracker row. Extracted so the Joints card can sit between rows. */
  const renderTracker = (tracker: NudgeDayTracker) => {
    // Mood & sleep keep the emoji scale + extras via their sheets.
    if (EMOJI_TRACKERS.has(tracker.nudgeId)) {
      const answered = tracker.answer !== null;
      const openSheet = () =>
        tracker.nudgeId === 'L1-003' ? setMoodOpen(true) : setSleepOpen(true);
      return (
        <div key={tracker.nudgeId} className="flex items-center justify-between gap-2">
          <div>
            <span
              id={`${rowId}-${tracker.nudgeId}-label`}
              className="text-[13px] text-on-surface"
              style={{ fontFamily: FONT_BODY }}
            >
              {/* Tracker labels and answers come from the day sheet, so they arrive already in
                  her language and are rendered as given. */}
              {tracker.label}
              {answered && <LoggedTick />}
            </span>
            <p
              className="text-[12px] text-on-surface-variant"
              style={{ fontFamily: FONT_BODY }}
            >
              {answered ? tracker.answer : t('track.notLoggedYet')}
            </p>
          </div>
          <button
            type="button"
            id={`${rowId}-${tracker.nudgeId}-open`}
            aria-labelledby={`${rowId}-${tracker.nudgeId}-open ${rowId}-${tracker.nudgeId}-label`}
            onClick={openSheet}
            className="rounded-full border border-border-default px-3.5 py-1.5 text-[12px] text-on-surface"
            style={{ fontFamily: FONT_BODY }}
          >
            {answered ? t('track.change') : t('track.log')}
          </button>
        </div>
      );
    }

    const answer = answerOf(tracker);
    const answered = answer !== null;
    const showOptions = !answered || editing.has(tracker.nudgeId);
    return (
      <div key={tracker.nudgeId}>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span
            id={`${rowId}-${tracker.nudgeId}-label`}
            className="text-[13px] text-on-surface"
            style={{ fontFamily: FONT_BODY }}
          >
            {tracker.label}
            {answered && <LoggedTick />}
          </span>
          {answered && !showOptions && (
            <button
              type="button"
              id={`${rowId}-${tracker.nudgeId}-change`}
              aria-labelledby={`${rowId}-${tracker.nudgeId}-change ${rowId}-${tracker.nudgeId}-label`}
              onClick={() => toggleEdit(tracker.nudgeId)}
              className="text-[10px] uppercase tracking-[0.1em] text-outline"
              style={{ fontFamily: FONT_MONO }}
            >
              {t('track.change')}
            </button>
          )}
        </div>

        {showOptions ? (
          <div
            className="flex flex-wrap gap-2"
            role="radiogroup"
            aria-labelledby={`${rowId}-${tracker.nudgeId}-label`}
          >
            {tracker.options.map((opt) => (
              <OptionChip
                key={opt}
                label={opt}
                selected={answer === opt}
                disabled={saving === tracker.nudgeId}
                onClick={() => submit(tracker, opt)}
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
  };

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 shrink-0 border-b border-border-default bg-primary-container">
        <div className="px-3 pb-[20px] pt-[max(0.875rem,env(safe-area-inset-top))]">
          <Eyebrow>
            {loading
              ? t('track.loading')
              : t(day === 'yesterday' ? 'track.loggedYesterday' : 'track.loggedToday', {
                  answered: answeredCount,
                  total,
                })}
          </Eyebrow>
          <h1 className="font-display mb-[16px] text-[30px] leading-[1.05] text-on-surface">
            {/* Trans, not three fragments: where her name and the emphasised word fall in the
                sentence is different in every language. */}
            <Trans
              i18nKey={day === 'yesterday' ? 'track.titleYesterday' : 'track.title'}
              values={{ name: firstName }}
              components={{
                1: <em className="not-italic text-primary" style={{ fontWeight: 300 }} />,
              }}
            />
          </h1>

          {/* Progress bar */}
          <div
            className="mb-[16px] h-2 w-full overflow-hidden rounded-full bg-surface-bright"
            role="progressbar"
            aria-label={t('a11y.tracking.trackProgress')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-valuetext={
              loading
                ? t('track.loading')
                : t(day === 'yesterday' ? 'track.loggedYesterday' : 'track.loggedToday', {
                    answered: answeredCount,
                    total,
                  })
            }
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Today or yesterday. Nothing further back: the strip below shows the week, but only
              these two days can still be filled in. */}
          <div
            className="mb-[14px] inline-flex rounded-full border border-border-default bg-surface-bright p-1"
            role="tablist"
            aria-label={t('track.dayPicker')}
          >
            {(['yesterday', 'today'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={day === option}
                onClick={() => switchDay(option)}
                className={`min-h-11 rounded-full px-4 text-[13px] font-semibold ${
                  day === option ? 'bg-primary text-on-primary' : 'text-on-surface'
                }`}
                style={{ fontFamily: FONT_BODY }}
              >
                {option === 'today' ? t('track.today') : t('track.yesterday')}
              </button>
            ))}
          </div>

          {/* A picture of the week; the tabs above already say which day she is filling in. */}
          <div className="flex justify-between gap-1" aria-hidden="true">
            {weekDays.map((cell) => {
              const selected = day === 'today' ? cell.isToday : cell.isYesterday;
              return (
                <div key={cell.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span
                    className={`text-[9px] uppercase tracking-[0.08em] ${selected ? 'text-primary' : 'text-outline'}`}
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {t(`track.weekdays.${cell.key}`)}
                  </span>
                  <span
                    className={`text-[11px] leading-none ${selected ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}
                    style={{ fontFamily: FONT_MONO }}
                  >
                    {cell.dateNum}
                  </span>
                  <div
                    className="flex items-center justify-center font-semibold"
                    style={{
                      width: selected ? '100%' : 10,
                      height: selected ? 28 : 10,
                      borderRadius: selected ? 14 : '50%',
                      background: selected ? '#5E3566' : '#FFFFFF',
                      color: selected ? '#FBF6F0' : '#3E2542',
                      fontFamily: FONT_BODY,
                      fontSize: selected ? 10 : 11,
                    }}
                  >
                    {selected ? (day === 'today' ? t('track.today') : t('track.yesterday')) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-3 pb-[22px] pt-[18px]" aria-busy={loading || undefined}>
        {error && (
          <div
            role="alert"
            className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-3 text-[13px] text-on-surface-variant"
          >
            {error}{' '}
            <button type="button" onClick={reload} className="text-primary underline">
              {t('common.retry')}
            </button>
          </div>
        )}

        {TIERS.map((tier) => {
          const items = trackers.filter((tracker) => tracker.tier === tier);
          const hasJoints = tier === 'body' && !jointLog.loading;
          // Body still has something to show when only Joints is available — it
          // is the one tracker on this page the nudge day sheet knows nothing about.
          if (items.length === 0 && !hasJoints) return null;
          const open = openTiers.has(tier);
          const tierTotal = items.length + (hasJoints ? 1 : 0);
          const tierAnswered =
            items.filter(isAnswered).length + (hasJoints && jointsAnswered ? 1 : 0);

          return (
            <section
              key={tier}
              className={`overflow-hidden rounded-[20px] border border-border-default ${
                open
                  ? 'bg-surface-raised'
                  : 'bg-surface-container-low'
              }`}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-controls={open ? `${rowId}-tier-${tier}` : undefined}
                onClick={() => toggleTier(tier)}
                className={`flex w-full items-center justify-between px-4 py-3.5 text-left ${
                  open ? 'bg-primary-container' : ''
                }`}
              >
                <span
                  className="text-[14px] font-medium text-on-surface"
                  style={{ fontFamily: FONT_BODY }}
                >
                  {t(`track.tiers.${tier}`)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${
                    open ? 'bg-surface-bright text-outline' : 'bg-primary-container text-primary'
                  }`}
                  style={{ fontFamily: FONT_MONO }}
                >
                  <span aria-hidden="true">
                    {tierAnswered}/{tierTotal} {open ? '▾' : '▸'}
                  </span>
                  <span className="sr-only">
                    {t('a11y.tracking.tierProgress', { answered: tierAnswered, total: tierTotal })}
                  </span>
                </span>
              </button>

              {open && (
                <div
                  id={`${rowId}-tier-${tier}`}
                  className="flex flex-col gap-4 border-t border-primary/10 px-4 py-4"
                >
                  {items.map((tracker) => (
                    <Fragment key={tracker.nudgeId}>
                      {renderTracker(tracker)}
                      {/* Body ordering per spec: Hot flashes, then Joints & Stiffness. */}
                      {hasJoints && tracker.nudgeId === JOINTS_AFTER_TRACKER && jointsCard}
                    </Fragment>
                  ))}
                  {/* Still show Joints if the hot-flash tracker is ever absent. */}
                  {hasJoints &&
                    !items.some((tracker) => tracker.nudgeId === JOINTS_AFTER_TRACKER) &&
                    jointsCard}
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
        key={`mood-${day}`}
        open={moodOpen}
        initialFeeling={todayMood?.feeling ?? null}
        initialEmotions={todayMood?.emotions ?? []}
        saving={moodSaving}
        onClose={() => setMoodOpen(false)}
        onSave={handleLogMood}
      />

      <SleepLogSheet
        key={`sleep-${day}`}
        open={sleepOpen}
        initialQuality={todaySleep?.quality ?? null}
        initialHours={todaySleep?.hours ?? null}
        initialDisruptions={todaySleep?.disruptions ?? []}
        saving={sleepSaving}
        onClose={() => setSleepOpen(false)}
        onSave={handleLogSleep}
      />

      <JointsLogSheet
        key={`joints-${day}`}
        open={jointsOpen}
        initial={todayJoints}
        saving={jointsSaving}
        onClose={() => setJointsOpen(false)}
        onSave={handleLogJoints}
      />

      <BottomNav />
    </main>
  );
}
