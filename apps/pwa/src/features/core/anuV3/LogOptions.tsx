import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AnuV3LogOption,
  LogJointBody,
  MoodEmotion,
  NudgeDayResponse,
  NudgeDayTracker,
  SleepDisruption,
  SleepHoursBucket,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';
import { JointsLogSheet } from '../components/JointsLogSheet';
import { MoodLogSheet } from '../components/MoodLogSheet';
import { SleepLogSheet } from '../components/SleepLogSheet';
import { useJointLog } from '../hooks/useJointLog';
import { useMoodLog } from '../hooks/useMoodLog';
import { useSleepLog } from '../hooks/useSleepLog';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/// The Track screen opens these two trackers in a sheet rather than inline.
const SLEEP_NUDGE = 'L1-001';
const MOOD_NUDGE = 'L1-003';

function optionKey(option: AnuV3LogOption): string {
  return option.kind === 'tracker' ? option.nudgeId : option.kind === 'quick' ? `quick:${option.symptom}` : 'joints';
}

/**
 * The trackers an ANU v3 reply offers to log. ANU only chose which: each button
 * opens that tracker exactly as the Track screen does — the same sheet, or the
 * same options inline — and she picks the values. Nothing is saved until she
 * does.
 */
export function LogOptions({ options }: { options: AnuV3LogOption[] }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [inline, setInline] = useState<NudgeDayTracker | null>(null);
  const [busy, setBusy] = useState(false);

  const markDone = (key: string) => {
    setDone((prev) => new Set(prev).add(key));
    setActive(null);
    setInline(null);
  };

  const label = (option: AnuV3LogOption) =>
    option.kind === 'tracker'
      ? option.label
      : option.kind === 'joints'
        ? t('track.joints')
        : t(`home.quickLogItems.${option.symptom}.label`);

  const open = async (option: AnuV3LogOption) => {
    const key = optionKey(option);
    setError(null);
    if (option.kind === 'quick') {
      // A quick-log symptom has no values to choose: the tap on "Log chills"
      // is her choice, as on the home screen.
      setBusy(true);
      try {
        await apiFetch('/api/quick-log', { method: 'POST', body: JSON.stringify({ symptom: option.symptom }) });
        markDone(key);
      } catch {
        setError(t('track.saveFailed'));
      } finally {
        setBusy(false);
      }
      return;
    }
    setActive(key);
    if (option.kind === 'tracker' && option.nudgeId !== SLEEP_NUDGE && option.nudgeId !== MOOD_NUDGE) {
      setBusy(true);
      try {
        const day = await apiFetch<NudgeDayResponse>('/api/nudge/day');
        const tracker = day.trackers.find((entry) => entry.nudgeId === option.nudgeId) ?? null;
        if (!tracker) setError(t('track.saveFailed'));
        setInline(tracker);
      } catch {
        setError(t('track.saveFailed'));
      } finally {
        setBusy(false);
      }
    }
  };

  const answerInline = async (answer: string) => {
    if (!inline) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/nudge/respond', {
        method: 'POST',
        body: JSON.stringify({ nudgeId: inline.nudgeId, answer }),
      });
      markDone(inline.nudgeId);
    } catch {
      setError(t('track.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setActive(null);
    setInline(null);
  };

  return (
    <div className="flex w-full flex-col gap-2" style={{ fontFamily: FONT_BODY }}>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const key = optionKey(option);
          const isDone = done.has(key);
          return (
            <button
              key={key}
              type="button"
              disabled={busy || isDone}
              onClick={() => void open(option)}
              className={`min-h-11 rounded-full border px-4 py-2 text-[13px] font-semibold disabled:opacity-70 ${
                active === key ? 'border-primary bg-primary/10 text-primary' : 'border-primary/30 bg-surface text-primary'
              }`}
            >
              {isDone ? `✓ ${t('chat.log.logged', { name: label(option) })}` : t('chat.log.button', { name: label(option) })}
            </button>
          );
        })}
      </div>

      {inline && active === inline.nudgeId && (
        <div className="rounded-[18px] border border-primary/25 bg-surface p-3.5">
          <p className="text-[13px] text-on-surface">{inline.question}</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {inline.options.map((opt) => (
              <button
                key={opt}
                type="button"
                disabled={busy}
                onClick={() => void answerInline(opt)}
                className="min-h-11 rounded-full border border-primary/20 bg-surface px-3.5 py-2 text-[12px] font-medium text-on-surface disabled:opacity-50"
              >
                {opt}
              </button>
            ))}
          </div>
          <button type="button" onClick={close} className="mt-2 min-h-11 text-[12px] text-on-surface-variant underline">
            {t('chat.log.cancel')}
          </button>
        </div>
      )}

      {error && <p className="text-[12px] text-error">{error}</p>}

      {active === SLEEP_NUDGE && <SleepLogger onClose={close} onSaved={() => markDone(SLEEP_NUDGE)} onError={setError} />}
      {active === MOOD_NUDGE && <MoodLogger onClose={close} onSaved={() => markDone(MOOD_NUDGE)} onError={setError} />}
      {active === 'joints' && <JointsLogger onClose={close} onSaved={() => markDone('joints')} onError={setError} />}
    </div>
  );
}

type LoggerProps = { onClose: () => void; onSaved: () => void; onError: (message: string) => void };

// Each logger mounts only while its sheet is open, so the chat screen does not
// load every tracker up front.

function SleepLogger({ onClose, onSaved, onError }: LoggerProps) {
  const { t } = useTranslation();
  const sleepLog = useSleepLog();
  const [saving, setSaving] = useState(false);
  const today = sleepLog.data?.today ?? null;
  const save = async (quality: number, hours: SleepHoursBucket | null, disruptions: SleepDisruption[]) => {
    setSaving(true);
    try {
      await sleepLog.logSleep(quality, hours, disruptions);
      onSaved();
    } catch {
      onError(t('track.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <SleepLogSheet
      open
      initialQuality={today?.quality ?? null}
      initialHours={today?.hours ?? null}
      initialDisruptions={today?.disruptions ?? []}
      saving={saving}
      onClose={onClose}
      onSave={save}
    />
  );
}

function MoodLogger({ onClose, onSaved, onError }: LoggerProps) {
  const { t } = useTranslation();
  const moodLog = useMoodLog();
  const [saving, setSaving] = useState(false);
  const today = moodLog.data?.today ?? null;
  const save = async (feeling: number, emotions: MoodEmotion[]) => {
    setSaving(true);
    try {
      await moodLog.logMood(feeling, emotions);
      onSaved();
    } catch {
      onError(t('track.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <MoodLogSheet
      open
      initialFeeling={today?.feeling ?? null}
      initialEmotions={today?.emotions ?? []}
      saving={saving}
      onClose={onClose}
      onSave={save}
    />
  );
}

function JointsLogger({ onClose, onSaved, onError }: LoggerProps) {
  const { t } = useTranslation();
  const jointLog = useJointLog();
  const [saving, setSaving] = useState(false);
  const save = async (body: LogJointBody) => {
    setSaving(true);
    try {
      await jointLog.logJoints(body);
      onSaved();
    } catch {
      onError(t('track.saveFailed'));
    } finally {
      setSaving(false);
    }
  };
  return (
    <JointsLogSheet open initial={jointLog.data?.today ?? null} saving={saving} onClose={onClose} onSave={save} />
  );
}
