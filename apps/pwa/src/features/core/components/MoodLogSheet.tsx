import { useEffect, useMemo, useState } from 'react';
import type { MoodEmotion } from '@anuva/shared';
import { useTranslation } from 'react-i18next';
import { twemojiUrl } from '../../../shared/lib/twemoji';

type MoodLogSheetProps = {
  open: boolean;
  initialFeeling?: number | null;
  initialEmotions?: MoodEmotion[];
  saving?: boolean;
  onClose: () => void;
  onSave: (feeling: number, emotions: MoodEmotion[]) => void | Promise<void>;
};

/** The five-point scale, as stored values and their emoji. Labels: `moodSheet.feelings.<value>`. */
const FEELINGS: { value: number; emoji: string }[] = [
  { value: 5, emoji: '😄' },
  { value: 4, emoji: '😊' },
  { value: 3, emoji: '😐' },
  { value: 2, emoji: '😔' },
  { value: 1, emoji: '😩' },
];

/** Stored values, in display order. Labels: `moodSheet.emotions.<value>`. */
const EMOTIONS: MoodEmotion[] = [
  'calm',
  'energized',
  'anxious',
  'irritable',
  'sad',
  'tearful',
  'foggy',
  'overwhelmed',
];

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

export function MoodLogSheet({
  open,
  initialFeeling,
  initialEmotions,
  saving = false,
  onClose,
  onSave,
}: MoodLogSheetProps) {
  const { t } = useTranslation();
  const [feeling, setFeeling] = useState<number | null>(null);
  const [emotions, setEmotions] = useState<MoodEmotion[]>([]);

  const initialEmotionsKey = useMemo(() => (initialEmotions ?? []).join(','), [initialEmotions]);

  useEffect(() => {
    if (!open) return;
    setFeeling(initialFeeling ?? null);
    setEmotions(initialEmotions ?? []);
  }, [open, initialFeeling, initialEmotionsKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleEmotion = (value: MoodEmotion) => {
    setEmotions((prev) =>
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (feeling == null) return;
    await onSave(feeling, emotions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label={t('moodSheet.close')}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[360px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto' }}
      >
        <div
          className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="h-px w-3 bg-primary/60" />
          {t('moodSheet.eyebrow')}
        </div>
        <h2
          className="mb-5 text-[20px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          {t('moodSheet.title')}
        </h2>

        <div className="mb-6 grid grid-cols-5 gap-2">
          {FEELINGS.map((f) => {
            const selected = feeling === f.value;
            const label = t(`moodSheet.feelings.${f.value}`);
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFeeling(f.value)}
                aria-pressed={selected}
                className="flex flex-col items-center gap-1.5 rounded-[16px] bg-transparent px-1 py-2 outline-none transition-transform focus:outline-none focus-visible:outline-none"
                style={{
                  transform: selected ? 'scale(1.28)' : 'scale(1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <img src={twemojiUrl(f.emoji)} alt={label} width={34} height={34} />
                <span
                  className={`text-[9px] uppercase tracking-[0.04em] ${selected ? 'text-on-surface' : 'text-outline'}`}
                  style={{ fontFamily: FONT_MONO }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
          {t('moodSheet.anythingSpecific')}{' '}
          <span className="text-outline">{t('moodSheet.optional')}</span>
        </p>
        <div className="mb-7 flex flex-wrap gap-2">
          {EMOTIONS.map((emotion) => {
            const selected = emotions.includes(emotion);
            return (
              <button
                key={emotion}
                type="button"
                onClick={() => toggleEmotion(emotion)}
                aria-pressed={selected}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  fontFamily: FONT_BODY,
                  backgroundColor: selected ? '#5E3566' : 'transparent',
                  color: selected ? '#FBF6F0' : '#3E2542',
                  borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                }}
              >
                {t(`moodSheet.emotions.${emotion}`)}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={feeling == null || saving}
          className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ fontFamily: FONT_BODY }}
        >
          {saving ? t('common.saving') : t('moodSheet.save')}
        </button>
      </div>
    </div>
  );
}
