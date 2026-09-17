import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { data, loading, error, respond } = useNudgeToday(slot);
  const moodLog = useMoodLog();
  const sleepLog = useSleepLog();
  const [index, setIndex] = useState(0);
  const [finalReply, setFinalReply] = useState<string | null>(null);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const completedSheetSave = useRef(false);

  const cards = data?.cards ?? [];
  const card: NudgeCard | undefined = cards[index];
  const isEmojiCard = card ? EMOJI_TRACKERS.has(card.nudgeId) : false;
  const shouldOpenTargetSheet = !loading && !error && !done && card && isEmojiCard;

  useEffect(() => {
    completedSheetSave.current = false;
    setAnswerError(null);
    if (isEmojiCard && !done) {
      setSheetOpen(true);
    }
  }, [card?.nudgeId, isEmojiCard, done]);

  const finish = async (message: string) => {
    setFinalReply(message);
    setDone(true);
    await onComplete?.();
  };

  const completeCard = async (message: string) => {
    setAnswerError(null);
    setSheetOpen(false);
    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
      return;
    }
    await finish(message);
  };

  const handleLogMood = async (feeling: number, emotions: MoodEmotion[]) => {
    setSaving(true);
    try {
      await moodLog.logMood(feeling, emotions);
      completedSheetSave.current = true;
      await completeCard(t('nudgeCard.moodLogged'));
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
      completedSheetSave.current = true;
      await completeCard(t('nudgeCard.sleepLogged'));
    } finally {
      setSaving(false);
    }
  };

  const handleAnswer = async (answer: string) => {
    if (!card || saving) return;
    setSaving(true);
    try {
      const res = await respond({ nudgeId: card.nudgeId, answer });
      await completeCard(res.message);
    } catch {
      setAnswerError(t('nudgeCard.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTargetSheetClose = () => {
    if (completedSheetSave.current) {
      setSheetOpen(false);
      return;
    }
    onClose();
  };

  if (shouldOpenTargetSheet) {
    return (
      <>
        <MoodLogSheet
          open={sheetOpen && card.nudgeId === 'L1-003'}
          saving={saving}
          onClose={handleTargetSheetClose}
          onSave={handleLogMood}
        />
        <SleepLogSheet
          open={sheetOpen && card.nudgeId === 'L1-001'}
          saving={saving}
          onClose={handleTargetSheetClose}
          onSave={handleLogSleep}
        />
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label={t('nudgeCard.closeCheckIn')}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto', fontFamily: FONT_BODY }}
      >
        {loading && (
          <p className="text-[14px] text-on-surface-variant">{t('nudgeCard.loadingDots')}</p>
        )}
        {error && <p className="text-[14px] text-on-surface-variant">{error}</p>}

        {!loading && !error && (cards.length === 0 || done) && (
          <div className="text-center">
            <h2
              className="mb-2 text-[20px] text-on-surface"
              style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
            >
              {done ? t('nudgeCard.allDone') : t('nudgeCard.nothingNow')}
            </h2>
            <p className="text-[13px] text-on-surface-variant">
              {done ? (finalReply ?? t('nudgeCard.thankYou')) : t('nudgeCard.comeBack')}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-primary py-3 text-[14px] font-medium text-surface"
            >
              {t('nudgeCard.backToHome')}
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
                {t('nudgeCard.bundleProgress', {
                  title: data.bundleTitle,
                  current: index + 1,
                  total: cards.length,
                })}
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
                {card.nudgeId === 'L1-003' ? t('nudgeCard.logMood') : t('nudgeCard.logSleep')}
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
