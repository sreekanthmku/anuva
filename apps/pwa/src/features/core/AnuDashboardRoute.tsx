import { useEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { MoodEmotion, QuickSymptom, SleepDisruption, SleepHoursBucket } from '@anuva/shared';
import { Angry, Brain, Check, Coffee, Fan, Flame, HeartHandshake, Moon, Smile, Snowflake, Wind } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { NotificationPermissionDialog } from './components/NotificationPermissionDialog';
import { NotificationSyncBanner } from './components/NotificationSyncBanner';
import { CycleTrackerSheet } from './components/CycleTrackerSheet';
import { CycleTrackerSummary } from './components/CycleTrackerSummary';
import { MoodLogSheet } from './components/MoodLogSheet';
import { SleepLogSheet } from './components/SleepLogSheet';
import { QuickLogMessageDialog } from './components/QuickLogMessageDialog';
import { useHomeNotificationPrompt } from './hooks/useHomeNotificationPrompt';
import { useCycleTracker } from './hooks/useCycleTracker';
import { useMoodLog } from './hooks/useMoodLog';
import { useSleepLog } from './hooks/useSleepLog';
import { useQuickLog } from './hooks/useQuickLog';
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
  color: string;
  icon: LucideIcon;
  action?: QuickLogAction;
  symptom?: QuickSymptom;
}[] = [
  { label: 'Hot flash', sub: 'Log now', color: '#F87171', icon: Flame, symptom: 'hot_flash' },
  { label: 'Sleep', sub: 'Rate last night', color: '#cebdff', icon: Moon, action: 'sleep' },
  { label: 'Mood', sub: 'How are you?', color: '#dbc839', icon: Smile, action: 'mood' },
  { label: 'Anxiety', sub: 'Log now', color: '#c084fc', icon: Brain, symptom: 'anxiety' },
  { label: 'Chills', sub: 'Log now', color: '#7dd3fc', icon: Snowflake, symptom: 'chills' },
  { label: 'Irritability', sub: 'Log now', color: '#fb923c', icon: Angry, symptom: 'irritability' },
];

const MOOD_FEELING_LABELS: Record<number, string> = {
  5: 'Feeling great',
  4: 'Feeling good',
  3: 'Feeling okay',
  2: 'Feeling low',
  1: 'Feeling awful',
};

const QUICK_SYMPTOM_RESPONSE: Record<
  QuickSymptom,
  { icon: LucideIcon; color: string; caption: string }
> = {
  hot_flash: { icon: Fan, color: '#7dd3fc', caption: 'Cool down — this passes' },
  anxiety: { icon: HeartHandshake, color: '#cebdff', caption: "You're held — breathe" },
  chills: { icon: Coffee, color: '#fbbf24', caption: "Warm up — you're okay" },
  irritability: { icon: Wind, color: '#6ee7b7', caption: 'Exhale — let the tension out' },
};

const SLEEP_QUALITY_LABELS: Record<number, string> = {
  5: 'Slept great',
  4: 'Slept good',
  3: 'Slept okay',
  2: 'Slept poorly',
  1: 'Slept awful',
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

export default function AnuDashboardRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);
  const [quickMessage, setQuickMessage] = useState<{
    title: string;
    message: string;
    icon: LucideIcon;
    color: string;
    caption: string;
    count: number;
  } | null>(null);
  const cycle = useCycleTracker();
  const mood = useMoodLog();
  const sleep = useSleepLog();
  const quick = useQuickLog();
  const todayMood = mood.data?.today ?? null;
  const todaySleep = sleep.data?.today ?? null;
  const quickCounts = quick.data?.counts ?? null;

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setMoodSaving(true);
    try {
      await mood.logMood(feeling, emotions);
    } finally {
      setMoodSaving(false);
    }
  };

  const handleLogSleep = async (
    quality: number,
    hours: SleepHoursBucket | null,
    disruptions: SleepDisruption[],
  ) => {
    setSleepSaving(true);
    try {
      await sleep.logSleep(quality, hours, disruptions);
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

  const handleLogSymptom = async (symptom: QuickSymptom, label: string) => {
    try {
      const result = await quick.logSymptom(symptom);
      const response = QUICK_SYMPTOM_RESPONSE[symptom];
      setQuickMessage({
        title: label,
        message: result.message,
        icon: response.icon,
        color: response.color,
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

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 pt-[40px] text-on-surface">
      <NotificationPermissionDialog
        open={notificationPrompt.open}
        isRegistering={notificationPrompt.isRegistering}
        onAccept={notificationPrompt.accept}
        onDismiss={notificationPrompt.dismiss}
      />
      <section className="px-[22px] pb-[14px]">
        {notificationPrompt.syncMessage && (
          <NotificationSyncBanner
            message={notificationPrompt.syncMessage}
            onRetry={notificationPrompt.retrySync}
            onDismiss={notificationPrompt.clearSyncMessage}
          />
        )}

        <header className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
            <span
              className="text-[16px] tracking-[0.16em] text-on-surface"
              style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 500 }}
            >
              ANUVA
            </span>
          </div>
          <NavLink
            to="/profile"
            aria-label="Open profile"
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] text-primary transition-opacity hover:opacity-90"
            style={{
              background: '#1d1a21',
              borderColor: 'rgba(148, 142, 157, 0.35)',
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 500,
            }}
          >
            {profileInitial}
          </NavLink>
        </header>

        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
          <span
            className="text-[10px] uppercase tracking-[0.18em] text-primary"
            style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
          >
            {greeting},
          </span>
          <h1 className="font-display text-[34px] leading-[1] text-on-surface">
            <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
              {firstName}
            </em>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            {memberDay !== null && memberWeek ? `Day ${memberDay} · Week ${memberWeek}` : 'Day 0 · Week 1'}
          </span>
          <span className="text-outline/40">·</span>
          <span
            className="rounded-full border px-[9px] py-[3px] text-[9.5px] uppercase tracking-[0.1em]"
            style={{
              background: 'rgba(219, 200, 57, 0.16)',
              borderColor: 'rgba(219, 200, 57, 0.3)',
              color: '#dbc839',
              fontFamily: '"Geist Mono", ui-monospace, monospace',
            }}
          >
            ● Perimenopause
          </span>
        </div>
      </section>

      <section className="px-[22px]">
        <article className="flex items-center gap-4 rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space px-5 py-[18px]">
          <div className="relative h-24 w-24 shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#2b2930" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke={isCalibrating ? '#948e9d' : '#cebdff'}
                strokeWidth="6"
                strokeDasharray={`${isCalibrating ? calibrationArc : scoreDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
                opacity={isCalibrating ? 0.85 : 1}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {isCalibrating ? (
                <>
                  <span
                    className="text-[22px] leading-none text-on-surface"
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                  >
                    {calibration ? `${calibration.day}/${calibration.totalDays}` : '—'}
                  </span>
                  <span className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    calibrating
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[30px] leading-none text-on-surface">{score}</span>
                  <span className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    balance
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
              <span className="h-px w-3 bg-primary/60" />
              <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                {isCalibrating ? 'Your first week' : "Today's wellness"}
              </span>
            </div>
            {isCalibrating ? (
              <>
                <p
                  className="mb-2 text-[18px] leading-[1.25] text-on-surface"
                  style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
                >
                  We&apos;re learning your rhythm.
                </p>
                {calibration && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-container-low px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] text-outline"
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                  >
                    Day {calibration.day} of {calibration.totalDays}
                    {calibration.daysRemaining > 0 ? ` · ${calibration.daysRemaining}d left` : ''}
                  </span>
                )}
              </>
            ) : (
              <>
                <p
                  className="mb-2 text-[18px] leading-[1.25] text-on-surface"
                  style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
                >
                  Steady, with gentle friction.
                </p>
                <div className="flex flex-wrap gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Sleep +12%
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-error" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-error" />
                    Hot flashes ↑
                  </span>
                </div>
              </>
            )}
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-[14px]">
        <article className="rounded-[24px] border border-border-default bg-surface-container-low px-[18px] py-4">
          <div className="flex items-start gap-3.5">
            <img src="/anu.png" alt="ANU avatar" className="mt-0.5 h-[26px] w-[26px] shrink-0 object-contain" />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
                <span className="h-px w-3 bg-primary/60" />
                <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>ANU · just now</span>
              </div>
              <p
                className="text-[16px] leading-[1.4] text-on-surface"
                style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
              >
                &quot;You logged two hot flashes yesterday. Want me to suggest a 3-minute cooling ritual for tonight?&quot;
              </p>
              <div className="mt-3 flex gap-1.5">
                <button type="button" className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-[12px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Yes, show me
                </button>
                <button type="button" className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Later
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-outline">
            <span className="h-px w-3 bg-outline/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Quick log</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Tap to track
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {QUICK_LOG_ITEMS.map((item) => {
            const Icon = item.icon;
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
              className={`rounded-[16px] border p-[10px] text-left outline-none transition-opacity focus:outline-none focus-visible:outline-none enabled:active:opacity-80 disabled:cursor-default ${
                logged ? 'border-primary/40 bg-primary/[0.07]' : 'border-border-default bg-surface-container-low'
              }`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="mb-2 flex min-h-[26px] items-start justify-between gap-1">
                <span
                  className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full"
                  style={{ background: item.color }}
                  aria-hidden="true"
                >
                  <Icon size={14} strokeWidth={2.25} className="text-surface" />
                </span>
                {logged ? (
                  <span
                    className="inline-flex items-center gap-0.5 text-[8px] uppercase leading-tight tracking-[0.06em] text-primary"
                    style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                  >
                    <Check size={9} strokeWidth={3} /> Logged
                  </span>
                ) : (
                  symptomCount > 0 && (
                    <span
                      className="max-w-[52px] text-right text-[8px] uppercase leading-tight tracking-[0.06em] text-error"
                      style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                    >
                      {symptomCount} TODAY
                    </span>
                  )
                )}
              </div>
              <p
                className="text-[12px] font-medium leading-tight text-on-surface"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {item.label}
              </p>
              <p
                className="mt-0.5 text-[10px] leading-snug text-outline"
                style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
              >
                {sub}
              </p>
            </button>
            );
          })}
        </div>
      </section>

      <section className="px-[22px] pt-4">
        <button
          type="button"
          onClick={() => setCycleOpen(true)}
          className="w-full rounded-[24px] border border-border-default bg-surface-container-low px-[16px] py-[16px] text-left transition-opacity active:opacity-80"
        >
          <div className="mb-3 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
            <span className="h-px w-3 bg-primary/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Cycle tracker</span>
          </div>
          <CycleTrackerSummary cycleData={cycle.data} loading={cycle.loading} />
        </button>
      </section>

      {!detailedCompleted && (
        <section className="px-[22px] pt-4">
          <article
            className="overflow-hidden rounded-[28px] border px-5 py-5"
            style={{
              background: 'linear-gradient(145deg, rgba(36, 25, 47, 0.96), rgba(24, 18, 37, 0.98))',
              borderColor: 'rgba(206, 189, 255, 0.18)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.32)',
            }}
          >
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#dbc839' }}>
              <span className="h-px w-3 bg-[#dbc839]/70" />
              <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Next step required</span>
            </div>

            <p
              className="max-w-[24ch] text-[17px] leading-[1.4] text-on-surface"
              style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}
            >
              Let&apos;s go deeper with your assessment
            </p>

            <p
              className="mt-3 max-w-[28ch] text-[12px] leading-[1.5]"
              style={{ color: '#b5acbf', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
            >
              Your detailed assessment helps ANU personalise your care path. Takes about 8 minutes.
            </p>

            <button
              type="button"
              onClick={() => navigate('/detailed-assessment')}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
              style={{
                fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
                fontWeight: 500,
                letterSpacing: '-0.005em',
              }}
            >
              {detailedStatus === 'in_progress' ? 'Resume detailed assessment' : 'Start detailed assessment'}
              <span aria-hidden="true">→</span>
            </button>
          </article>
        </section>
      )}

      <section className="px-[22px] pb-[22px] pt-4">
        <article className="rounded-[24px] border px-[18px] py-4" style={{ background: 'rgba(219, 200, 57, 0.16)', borderColor: 'rgba(219, 200, 57, 0.3)' }}>
          <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#dbc839' }}>
            <span className="h-px w-3 bg-[#dbc839]/70" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Today&apos;s insight</span>
          </div>
          <p className="text-[17px] leading-[1.4] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}>
            Cooling the bedroom to 22°C before sleep can reduce night sweats by up to 40%.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Dr. Meera Rao · AIIMS
            </span>
            <span className="text-[12px] font-medium" style={{ color: '#dbc839', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
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
        title={quickMessage?.title ?? ''}
        message={quickMessage?.message ?? ''}
        icon={quickMessage?.icon ?? null}
        iconColor={quickMessage?.color ?? '#cebdff'}
        caption={quickMessage?.caption ?? ''}
        count={quickMessage?.count ?? 0}
        onClose={() => setQuickMessage(null)}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--bottom-nav-height)+16px)] z-[80] flex justify-center px-4">
          <div
            className="max-w-[340px] rounded-full border border-border-default bg-surface-raised px-4 py-2.5 text-[12px] text-on-surface shadow-xl"
            style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
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
