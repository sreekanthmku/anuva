import { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Annoyed, Frown, Laugh, Meh, Smile } from 'lucide-react';
import type { MoodEmotion } from '@anuva/shared';

type MoodLogSheetProps = {
  open: boolean;
  initialFeeling?: number | null;
  initialEmotions?: MoodEmotion[];
  saving?: boolean;
  onClose: () => void;
  onSave: (feeling: number, emotions: MoodEmotion[]) => void | Promise<void>;
};

const FEELINGS: { value: number; label: string; icon: LucideIcon; color: string }[] = [
  { value: 5, label: 'Great', icon: Laugh, color: '#6ee7b7' },
  { value: 4, label: 'Good', icon: Smile, color: '#a7f3d0' },
  { value: 3, label: 'Okay', icon: Meh, color: '#dbc839' },
  { value: 2, label: 'Low', icon: Frown, color: '#fb923c' },
  { value: 1, label: 'Awful', icon: Annoyed, color: '#F87171' },
];

const EMOTIONS: { value: MoodEmotion; label: string }[] = [
  { value: 'calm', label: 'Calm' },
  { value: 'energized', label: 'Energized' },
  { value: 'anxious', label: 'Anxious' },
  { value: 'irritable', label: 'Irritable' },
  { value: 'sad', label: 'Sad' },
  { value: 'tearful', label: 'Tearful' },
  { value: 'foggy', label: 'Foggy' },
  { value: 'overwhelmed', label: 'Overwhelmed' },
];

const FONT_BODY = '"Geist", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", ui-monospace, monospace';

export function MoodLogSheet({
  open,
  initialFeeling,
  initialEmotions,
  saving = false,
  onClose,
  onSave,
}: MoodLogSheetProps) {
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
      prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value],
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
        aria-label="Close mood log"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[360px] rounded-[24px] border border-border-default bg-surface-raised px-[22px] py-6 shadow-xl"
        style={{ maxHeight: '88dvh', overflowY: 'auto' }}
      >
        <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary" style={{ fontFamily: FONT_MONO }}>
          <span className="h-px w-3 bg-primary/60" />
          Mood check-in
        </div>
        <h2
          className="mb-5 text-[20px] text-on-surface"
          style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}
        >
          How are you feeling?
        </h2>

        <div className="mb-6 grid grid-cols-5 gap-2">
          {FEELINGS.map((f) => {
            const Icon = f.icon;
            const selected = feeling === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFeeling(f.value)}
                aria-pressed={selected}
                className="flex flex-col items-center gap-1.5 rounded-[16px] bg-transparent px-1 py-2 outline-none transition-transform focus:outline-none focus-visible:outline-none"
                style={{ transform: selected ? 'scale(1.28)' : 'scale(1)', WebkitTapHighlightColor: 'transparent' }}
              >
                <Icon
                  size={34}
                  strokeWidth={1.5}
                  fill={f.color}
                  style={{ color: '#322f37' }}
                />
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

        <p className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
          Anything specific? <span className="text-outline">(optional)</span>
        </p>
        <div className="mb-7 flex flex-wrap gap-2">
          {EMOTIONS.map((e) => {
            const selected = emotions.includes(e.value);
            return (
              <button
                key={e.value}
                type="button"
                onClick={() => toggleEmotion(e.value)}
                aria-pressed={selected}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  fontFamily: FONT_BODY,
                  backgroundColor: selected ? '#cebdff' : 'transparent',
                  color: selected ? '#322f37' : '#e6e0ea',
                  borderColor: selected ? '#cebdff' : 'rgba(148, 142, 157, 0.35)',
                }}
              >
                {e.label}
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
          {saving ? 'Saving…' : 'Save mood'}
        </button>
      </div>
    </div>
  );
}
