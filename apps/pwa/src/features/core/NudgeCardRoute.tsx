import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type {
  MoodEmotion,
  NudgeCard,
  NudgeSlot,
  SleepDisruption,
  SleepHoursBucket,
} from '@anuva/shared';
import { useNudgeToday } from './hooks/useNudgeToday';
import { useMoodLog } from './hooks/useMoodLog';
import { useSleepLog } from './hooks/useSleepLog';
import { MoodLogSheet } from './components/MoodLogSheet';
import { SleepLogSheet } from './components/SleepLogSheet';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

// Mood (L1-003) + sleep (L1-001) use the emoji scale + extras, not chips.
const EMOJI_TRACKERS = new Set(['L1-001', 'L1-003']);

// Collapsed tap-card bundle for the current slot. Each card is answered in place;
// successful answers advance immediately and only the final reply is shown.
export default function NudgeCardRoute() {
  const navigate = useNavigate();
  const { slot } = useParams();
  const requestedSlot: NudgeSlot | undefined =
    slot === 'morning' || slot === 'afternoon' || slot === 'evening' ? slot : undefined;
  const { data, loading, error, respond } = useNudgeToday(requestedSlot);
  const moodLog = useMoodLog();
  const sleepLog = useSleepLog();
  const [index, setIndex] = useState(0);
  const [finalReply, setFinalReply] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const cards = data?.cards ?? [];
  const card: NudgeCard | undefined = cards[index];
  const isEmojiCard = card ? EMOJI_TRACKERS.has(card.nudgeId) : false;

  const completeCard = (message: string) => {
    setAnswerError(null);
    setSheetOpen(false);
    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      return;
    }
    setFinalReply(message);
    setDone(true);
  };

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setSaving(true);
    try {
      await moodLog.logMood(feeling, emotions);
      completeCard("Emotional days are not weakness. I'll track this carefully.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogSleep = async (
    quality: number,
    hours: SleepHoursBucket | null,
    disruptions: SleepDisruption[]
  ) => {
    setSaving(true);
    try {
      await sleepLog.logSleep(quality, hours, disruptions);
      completeCard("Thanks for logging your sleep. I'll factor it into today.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!card || saving) return;
    setSaving(true);
    try {
      const res = await respond({ nudgeId: card.nudgeId, answer });
      completeCard(res.message);
    } catch {
      setAnswerError("I couldn't save that just now. We'll try again later.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-surface px-5 py-8" style={{ fontFamily: FONT_BODY }}>
      <div className="mx-auto w-full max-w-[400px]">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="mb-6 text-[12px] text-on-surface-variant"
          style={{ fontFamily: FONT_MONO }}
        >
          ← Home
        </button>

        {loading && <p className="text-on-surface-variant">Loading your check-in…</p>}
        {error && <p className="text-on-surface-variant">{error}</p>}

        {!loading && !error && (cards.length === 0 || done) && (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-6 py-10 text-center">
            <h2
              className="mb-2 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {done ? "That's all for now." : 'Nothing to check in on right now.'}
            </h2>
            <p className="text-[13px] text-on-surface-variant">
              {done ? (finalReply ?? 'Thank you for sharing with me today.') : 'Come back at your next check-in.'}
            </p>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="mt-6 rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-surface"
            >
              Back to home
            </button>
          </div>
        )}

        {!loading && !error && !done && card && (
          <div className="rounded-[20px] border border-border-default bg-surface-raised px-2 py-7">
            {data?.bundleTitle && (
              <div
                className="mb-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
                style={{ fontFamily: FONT_MONO }}
              >
                <span className="h-px w-3 bg-primary/60" />
                {data.bundleTitle} · {index + 1}/{cards.length}
              </div>
            )}
            <h2
              className="mb-6 text-[19px] leading-snug text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {card.question}
            </h2>

            {isEmojiCard ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setSheetOpen(true)}
                className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface active:opacity-80 disabled:opacity-50"
              >
                {card.nudgeId === 'L1-003' ? 'Log your mood' : 'Log your sleep'}
              </button>
            ) : (
              <div className="flex flex-col gap-2.5">
                {card.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    disabled={saving}
                    onClick={() => handleAnswer(opt)}
                    className="w-full rounded-[16px] border border-border-default bg-transparent px-4 py-3 text-left text-[14px] text-on-surface transition-colors active:bg-primary/10 disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
                {answerError && (
                  <p className="pt-1 text-[13px] leading-relaxed text-on-surface-variant">
                    {answerError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <MoodLogSheet
        open={sheetOpen && card?.nudgeId === 'L1-003'}
        saving={saving}
        onClose={() => setSheetOpen(false)}
        onSave={handleLogMood}
      />
      <SleepLogSheet
        open={sheetOpen && card?.nudgeId === 'L1-001'}
        saving={saving}
        onClose={() => setSheetOpen(false)}
        onSave={handleLogSleep}
      />
    </div>
  );
}
