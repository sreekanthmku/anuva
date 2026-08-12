import { useEffect, useRef, useState } from 'react';
import type {
  MoodEmotion,
  NudgeSlot,
  QuickSymptom,
  SleepDisruption,
  SleepHoursBucket,
} from '@anuva/shared';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { Check } from 'lucide-react';
import { twemojiUrl } from '../../shared/lib/twemoji';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { NotificationPermissionDialog } from './components/NotificationPermissionDialog';
import { NotificationSyncBanner } from './components/NotificationSyncBanner';
import { CycleTrackerSheet } from './components/CycleTrackerSheet';
import { CyclePhaseBadge, CycleTrackerSummary } from './components/CycleTrackerSummary';
import { MoodLogSheet } from './components/MoodLogSheet';
import { SleepLogSheet } from './components/SleepLogSheet';
import { QuickLogMessageDialog } from './components/QuickLogMessageDialog';
import { NudgeCheckInDialog } from './components/NudgeCheckInDialog';
import { useHomeNotificationPrompt } from './hooks/useHomeNotificationPrompt';
import { useCycleTracker } from './hooks/useCycleTracker';
import { useMoodLog } from './hooks/useMoodLog';
import { useSleepLog } from './hooks/useSleepLog';
import { useQuickLog } from './hooks/useQuickLog';
import { useNudgeDay } from './hooks/useNudgeDay';
import {
  getCalibrationProgress,
  getJourneyDay,
  getTrialStartDate,
  isWellnessCalibrating,
} from './wellnessCalibration';

const score = 72;
const circumference = 2 * Math.PI * 42;
const scoreDash = (score / 100) * circumference;

type QuickLogAction = 'mood' | 'sleep';

const QUICK_LOG_ITEMS: {
  label: string;
  sub: string;
  emoji: string;
  action?: QuickLogAction;
  symptom?: QuickSymptom;
}[] = [
  { label: 'Hot flash', sub: 'Log now', emoji: '🔥', symptom: 'hot_flash' },
  { label: 'Sleep', sub: 'Rate last night', emoji: '😴', action: 'sleep' },
  { label: 'Mood', sub: 'How are you?', emoji: '🌸', action: 'mood' },
  { label: 'Anxiety', sub: 'Log now', emoji: '😰', symptom: 'anxiety' },
  { label: 'Chills', sub: 'Log now', emoji: '🥶', symptom: 'chills' },
  { label: 'Irritability', sub: 'Log now', emoji: '😤', symptom: 'irritability' },
];

const MOOD_FEELING_LABELS: Record<number, string> = {
  5: 'Feeling great',
  4: 'Feeling good',
  3: 'Feeling okay',
  2: 'Feeling low',
  1: 'Feeling awful',
};

const SLEEP_QUALITY_LABELS: Record<number, string> = {
  5: 'Slept great',
  4: 'Slept good',
  3: 'Slept okay',
  2: 'Slept poorly',
  1: 'Slept awful',
};

const QUICK_SYMPTOM_RESPONSE: Record<QuickSymptom, { emoji: string; caption: string }> = {
  hot_flash: { emoji: '🌬️', caption: 'Cool down — this passes' },
  anxiety: { emoji: '🫂', caption: "You're held — breathe" },
  chills: { emoji: '🍵', caption: "Warm up — you're okay" },
  irritability: { emoji: '😮‍💨', caption: 'Exhale — let the tension out' },
};

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }

  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }

  return 'Good night';
}

const SERIF = '"Fraunces", serif';

export default function AnuDashboardRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const detailedStatus = user?.detailedAssessmentStatus ?? 'not_started';
  const detailedCompleted = detailedStatus === 'completed';
  const notificationPrompt = useHomeNotificationPrompt();
  const [greeting, setGreeting] = useState(() => getTimeGreeting());
  const [cycleOpen, setCycleOpen] = useState(false);
  const [moodOpen, setMoodOpen] = useState(false);
  const [moodSaving, setMoodSaving] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [sleepSaving, setSleepSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [nudgeSlot, setNudgeSlot] = useState<NudgeSlot | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );
  const [quickMessage, setQuickMessage] = useState<{
    message: string;
    emoji: string;
    caption: string;
    count: number;
  } | null>(null);
  const cycle = useCycleTracker();
  const mood = useMoodLog();
  const sleep = useSleepLog();
  const quick = useQuickLog();
  const nudgeDay = useNudgeDay();
  const todayMood = mood.data?.today ?? null;
  const todaySleep = sleep.data?.today ?? null;
  const quickCounts = quick.data?.counts ?? null;

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setMoodSaving(true);
    try {
      await mood.logMood(feeling, emotions);
      await nudgeDay.reload();
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
      await sleep.logSleep(quality, hours, disruptions);
      await nudgeDay.reload();
    } finally {
      setSleepSaving(false);
    }
  };

  const handleQuickLog = (action?: QuickLogAction) => {
    if (action === 'mood') {
      if (todayMood) {
        showToast('Mood already logged today — come back tomorrow.');
        return;
      }
      setMoodOpen(true);
    }
    if (action === 'sleep') {
      if (todaySleep) {
        showToast('Sleep already logged today — come back tomorrow.');
        return;
      }
      setSleepOpen(true);
    }
  };

  const handleLogSymptom = async (symptom: QuickSymptom, _label: string) => {
    try {
      const result = await quick.logSymptom(symptom);
      const response = QUICK_SYMPTOM_RESPONSE[symptom];
      setQuickMessage({
        message: result.message,
        emoji: response.emoji,
        caption: response.caption,
        count: result.todayCount,
      });
    } catch {
      showToast('Could not log right now. Try again.');
    }
  };
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const profileInitial = firstName.charAt(0).toUpperCase() || 'U';
  const trialStartedAt = getTrialStartDate(user);
  const isCalibrating = isWellnessCalibrating(trialStartedAt);
  const calibration = trialStartedAt ? getCalibrationProgress(trialStartedAt) : null;
  const memberDay = trialStartedAt ? getJourneyDay(trialStartedAt) : null;
  const memberWeek = memberDay !== null ? Math.floor(memberDay / 7) + 1 : null;
  const calibrationArc =
    calibration && circumference > 0
      ? (calibration.day / calibration.totalDays) * circumference
      : 0;

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeGreeting());

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const requestedNudge = searchParams.get('nudge');
    if (
      requestedNudge === 'morning' ||
      requestedNudge === 'afternoon' ||
      requestedNudge === 'evening'
    ) {
      setNudgeSlot(requestedNudge);
    }
  }, [searchParams]);

  const closeNudgeDialog = () => {
    setNudgeSlot(null);
    if (searchParams.has('nudge')) {
      const next = new URLSearchParams(searchParams);
      next.delete('nudge');
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 pt-8 text-on-surface">
      <NotificationPermissionDialog
        open={notificationPrompt.open}
        isRegistering={notificationPrompt.isRegistering}
        onAccept={notificationPrompt.accept}
        onDismiss={notificationPrompt.dismiss}
      />
      <section className="px-3 pb-2.5">
        {notificationPrompt.syncMessage && (
          <NotificationSyncBanner
            message={notificationPrompt.syncMessage}
            onRetry={notificationPrompt.retrySync}
            onDismiss={notificationPrompt.clearSyncMessage}
          />
        )}

        <header className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/anuva-logo-icon.png"
              alt="Anuva Wellness logo"
              className="h-10 w-10 object-contain"
            />
            <span
              className="text-[16px] tracking-[0.16em] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 500 }}
            >
              ANUVA WELLNESS
            </span>
          </div>
          <NavLink
            to="/profile"
            aria-label="Open profile"
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] text-primary transition-opacity hover:opacity-90"
            style={{
              background: '#EFE4D8',
              borderColor: 'rgba(180, 159, 176, 0.35)',
              fontFamily: '"Fraunces", sans-serif',
              fontWeight: 500,
            }}
          >
            {profileInitial}
          </NavLink>
        </header>

        <p
          className="text-[12px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          {greeting},
        </p>
        <h1
          className="mt-1 text-[40px] leading-[1.05] text-primary"
          style={{ fontFamily: SERIF, fontWeight: 500 }}
        >
          {firstName}
        </h1>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full bg-surface-container px-3 py-1 text-[12.5px] font-medium text-on-surface-variant"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            {memberDay !== null && memberWeek
              ? `Day ${memberDay} · Week ${memberWeek}`
              : 'Day 0 · Week 1'}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-container px-3 py-1 text-[12.5px] font-semibold text-on-tertiary-container"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-tertiary" />
            Perimenopause
          </span>
        </div>
      </section>

      <section className="px-3">
        <article className="flex items-center gap-4 rounded-[20px] bg-primary-container px-4 py-4">
          <div className="relative h-24 w-24 shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="rgba(94,53,102,0.16)"
                strokeWidth="6"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="#5E3566"
                strokeWidth="6"
                strokeDasharray={`${isCalibrating ? calibrationArc : scoreDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
                opacity={isCalibrating ? 0.6 : 1}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isCalibrating ? (
                <>
                  <span
                    className="text-[22px] leading-none text-on-surface"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {calibration ? `${calibration.day}/${calibration.totalDays}` : '—'}
                  </span>
                  <span
                    className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    calibrating
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[30px] leading-none text-on-surface">{score}</span>
                  <span
                    className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    balance
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1">
            <Eyebrow>{isCalibrating ? 'Your first week' : "Today's wellness"}</Eyebrow>
            {isCalibrating ? (
              <>
                <p
                  className="mb-2.5 text-[20px] leading-[1.25] text-on-surface"
                  style={{ fontFamily: SERIF }}
                >
                  We&apos;re learning your rhythm.
                </p>
                {calibration && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-bright px-3 py-1.5 text-[12px] font-medium text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    Day {calibration.day} of {calibration.totalDays}
                    {calibration.daysRemaining > 0 ? ` · ${calibration.daysRemaining}d left` : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                <p
                  className="mb-2.5 text-[20px] leading-[1.25] text-on-surface"
                  style={{ fontFamily: SERIF }}
                >
                  Steady, with gentle friction.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] text-primary"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Sleep +12%
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] text-error"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-error" />
                    Hot flashes ↑
                  </span>
                </div>
              </>
            )}
          </div>
        </article>
      </section>

      <section className="px-3 pt-3">
        <article className="rounded-[20px] bg-secondary-container px-[18px] py-4">
          <div className="flex items-start gap-3">
            <img
              src="/anu.png"
              alt="ANU avatar"
              className="mt-0.5 h-8 w-8 shrink-0 object-contain"
            />
            <div className="flex-1">
              <Eyebrow>ANU · just now</Eyebrow>
              <p
                className="text-[16px] leading-[1.45] text-on-surface"
                style={{ fontFamily: SERIF }}
              >
                &quot;You logged two hot flashes yesterday. Want me to suggest a 3-minute cooling
                ritual for tonight?&quot;
              </p>
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  className="rounded-full bg-primary px-5 py-2.5 text-[14px] font-semibold text-on-primary transition-opacity active:opacity-85"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Yes, show me
                </button>
                <button
                  type="button"
                  className="rounded-full border border-primary/25 px-5 py-2.5 text-[14px] font-semibold text-primary transition-colors active:bg-primary/5"
                  style={{ fontFamily: '"Mulish", sans-serif' }}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      {nudgeDay.data && nudgeDay.data.answeredCount < nudgeDay.data.total && (
        <section className="px-3 pt-3">
          <button
            type="button"
            onClick={() => navigate('/track')}
            className="flex w-full items-center justify-between rounded-[20px] border border-border-default bg-surface-container-low px-[18px] py-4 text-left transition-opacity active:opacity-80"
          >
            <div>
              <Eyebrow>Complete your day</Eyebrow>
              <p
                className="text-[15px] font-medium text-on-surface"
                style={{ fontFamily: '"Mulish", sans-serif' }}
              >
                {nudgeDay.data.total - nudgeDay.data.answeredCount} quick{' '}
                {nudgeDay.data.total - nudgeDay.data.answeredCount === 1 ? 'check-in' : 'check-ins'}{' '}
                left
              </p>
            </div>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[15px] text-primary">
              →
            </span>
          </button>
        </section>
      )}

      <section className="px-3 pt-3">
        <div className="mb-3 flex items-end justify-between">
          <Eyebrow>Quick log</Eyebrow>
          <span
            className="text-[12px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", sans-serif' }}
          >
            Tap to track
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_LOG_ITEMS.map((item) => {
            const interactive = Boolean(item.action || item.symptom);
            const symptomCount = item.symptom ? (quickCounts?.[item.symptom] ?? 0) : 0;
            let sub = item.sub;
            let logged = false;
            if (item.action === 'mood' && todayMood) {
              sub = MOOD_FEELING_LABELS[todayMood.feeling] ?? item.sub;
              logged = true;
            } else if (item.action === 'sleep' && todaySleep) {
              sub = SLEEP_QUALITY_LABELS[todaySleep.quality] ?? item.sub;
              logged = true;
            }
            return (
              <button
                key={item.label}
                type="button"
                disabled={!interactive}
                onClick={() =>
                  item.symptom
                    ? handleLogSymptom(item.symptom, item.label)
                    : handleQuickLog(item.action)
                }
                className={`flex min-h-[92px] flex-col justify-between rounded-[18px] border bg-surface-container-low p-3 text-left outline-none transition-opacity focus:outline-none focus-visible:outline-none enabled:active:opacity-80 disabled:cursor-default ${
                  logged ? 'border-primary/30' : 'border-border-default'
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <span className="flex items-start justify-between">
                  <img
                    src={twemojiUrl(item.emoji)}
                    alt=""
                    aria-hidden="true"
                    width={32}
                    height={32}
                    style={{ opacity: logged ? 0.5 : 1 }}
                  />
                  {logged ? (
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-on-primary">
                      <Check size={12} strokeWidth={3} />
                    </span>
                  ) : (
                    symptomCount > 0 && (
                      <span
                        className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary"
                        style={{ fontFamily: '"Mulish", sans-serif' }}
                      >
                        {symptomCount}×
                      </span>
                    )
                  )}
                </span>
                <span>
                  <span
                    className="block text-[14px] font-semibold leading-tight text-on-surface"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {item.label}
                  </span>
                  <span
                    className="mt-1 block text-[11.5px] leading-snug text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", sans-serif' }}
                  >
                    {sub}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setCycleOpen(true)}
          className="w-full rounded-[20px] bg-primary-fixed px-[18px] py-4 text-left transition-opacity active:opacity-80"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <Eyebrow className="mb-0">Cycle tracker</Eyebrow>
            {cycle.data?.phase ? <CyclePhaseBadge phase={cycle.data.phase} /> : null}
          </div>
          <CycleTrackerSummary cycleData={cycle.data} loading={cycle.loading} />
        </button>
      </section>

      {!detailedCompleted && (
        <section className="px-3 pt-3">
          <article className="overflow-hidden rounded-[20px] bg-primary px-[18px] py-5">
            <Eyebrow tone="cream">Next step required</Eyebrow>

            <p
              className="max-w-[20ch] text-[22px] leading-[1.25] text-on-primary"
              style={{ fontFamily: SERIF, fontWeight: 500 }}
            >
              Let&apos;s go deeper with your assessment
            </p>

            <p
              className="mt-3 max-w-[34ch] text-[13.5px] leading-[1.55]"
              style={{ color: '#E7D7E0', fontFamily: '"Mulish", sans-serif' }}
            >
              Your detailed assessment helps ANU personalise your care path. Takes about 8 minutes.
            </p>

            <button
              type="button"
              onClick={() => navigate('/detailed-assessment')}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-6 py-3.5 text-[15px] font-semibold text-on-secondary transition-opacity active:opacity-90"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {detailedStatus === 'in_progress'
                ? 'Resume detailed assessment'
                : 'Start detailed assessment'}
              <span aria-hidden="true">→</span>
            </button>
          </article>
        </section>
      )}

      <section className="px-3 pb-5 pt-3">
        <article className="rounded-[20px] bg-tertiary-container px-[18px] py-4">
          <Eyebrow tone="gold">Today&apos;s insight</Eyebrow>
          <p className="text-[18px] leading-[1.45] text-on-surface" style={{ fontFamily: SERIF }}>
            Cooling the bedroom to 22°C before sleep can reduce night sweats by up to 40%.
          </p>
          <div className="mt-3.5 flex items-center justify-between">
            <span
              className="text-[12px] font-medium text-on-surface-variant"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Dr. Meera Rao · AIIMS
            </span>
            <span
              className="text-[13px] font-semibold text-on-tertiary-container"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              Read →
            </span>
          </div>
        </article>
      </section>

      <CycleTrackerSheet
        open={cycleOpen}
        onClose={() => setCycleOpen(false)}
        cycleData={cycle.data}
        loading={cycle.loading}
        onSetup={cycle.setup}
        onLogPeriod={cycle.logPeriod}
        onEndPeriod={cycle.endPeriod}
        onDeletePeriod={cycle.deletePeriod}
        onUpdateSettings={cycle.updateSettings}
      />

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

      <QuickLogMessageDialog
        open={quickMessage !== null}
        message={quickMessage?.message ?? ''}
        emoji={quickMessage?.emoji ?? ''}
        caption={quickMessage?.caption ?? ''}
        onClose={() => setQuickMessage(null)}
      />

      {nudgeSlot && (
        <NudgeCheckInDialog
          slot={nudgeSlot}
          onClose={closeNudgeDialog}
          onComplete={nudgeDay.reload}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+16px)] z-[80] flex justify-center px-4">
          <div
            className="max-w-[340px] rounded-full border border-border-default bg-surface-raised px-4 py-2.5 text-[12px] text-on-surface border border-border-default"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
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
