import { useState } from 'react';
import type { MoodEmotion, NudgeCard, NudgeSlot, SleepDisruption, SleepHoursBucket } from '@anuva/shared';
import { useNudgeToday } from '../hooks/useNudgeToday';
import { useMoodLog } from '../hooks/useMoodLog';
import { useSleepLog } from '../hooks/useSleepLog';
import { MoodLogSheet } from './MoodLogSheet';
import { SleepLogSheet } from './SleepLogSheet';

type NudgeCheckInDialogProps = {
  slot: NudgeSlot;
  onClose: () => void;
  onComplete?: () => void | Promise<void>;
};

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';
const EMOJI_TRACKERS = new Set(['L1-001', 'L1-003']);

export function NudgeCheckInDialog({ slot, onClose, onComplete }: NudgeCheckInDialogProps) {
  const { data, loading, error, respond } = useNudgeToday(slot);
  const moodLog = useMoodLog();
  const sleepLog = useSleepLog();
  const [index, setIndex] = useState(0);
  const [reply, setReply] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const cards = data?.cards ?? [];
  const card: NudgeCard | undefined = cards[index];
  const isEmojiCard = card ? EMOJI_TRACKERS.has(card.nudgeId) : false;

  const finish = async () => {
    setDone(true);
    await onComplete?.();
  };

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setSaving(true);
    try {
      await moodLog.logMood(feeling, emotions);
      setReply("Emotional days are not weakness. I'll track this carefully.");
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
      setReply("Thanks for logging your sleep. I'll factor it into today.");
    } finally {
      setSaving(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!card || saving) return;
    setSaving(true);
    try {
      const res = await respond({ nudgeId: card.nudgeId, answer });
      setReply(res.message);
    } catch {
      setReply("I couldn't save that just now. We'll try again later.");
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    setReply(null);
    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      return;
    }
    await finish();
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close check-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto', fontFamily: FONT_BODY }}
      >
        {loading && <p className="text-[14px] text-on-surface-variant">Loading your check-in...</p>}
        {error && <p className="text-[14px] text-on-surface-variant">{error}</p>}

        {!loading && !error && (cards.length === 0 || done) && (
          <div className="text-center">
            <h2
              className="mb-2 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {done ? "That's all for now." : 'Nothing to check in on right now.'}
            </h2>
            <p className="text-[13px] text-on-surface-variant">
              {done ? 'Thank you for sharing with me today.' : 'Come back at your next check-in.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-primary py-3 text-[14px] font-medium text-surface"
            >
              Back to home
            </button>
          </div>
        )}

        {!loading && !error && !done && card && (
          <>
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

            {reply === null && isEmojiCard ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => setSheetOpen(true)}
                className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface active:opacity-80 disabled:opacity-50"
              >
                {card.nudgeId === 'L1-003' ? 'Log your mood' : 'Log your sleep'}
              </button>
            ) : reply === null ? (
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
              </div>
            ) : (
              <div>
                <p className="mb-6 text-[14px] leading-relaxed text-on-surface-variant">{reply}</p>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface active:opacity-80"
                >
                  {index + 1 < cards.length ? 'Next' : 'Done'}
                </button>
              </div>
            )}
          </>
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
