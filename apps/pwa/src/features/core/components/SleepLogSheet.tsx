import { useEffect, useMemo, useState } from 'react';
import type { SleepDisruption, SleepHoursBucket } from '@anuva/shared';
import { twemojiUrl } from '../../../shared/lib/twemoji';

type SleepLogSheetProps = {
  open: boolean;
  initialQuality?: number | null;
  initialHours?: SleepHoursBucket | null;
  initialDisruptions?: SleepDisruption[];
  saving?: boolean;
  onClose: () => void;
  onSave: (
    quality: number,
    hours: SleepHoursBucket | null,
    disruptions: SleepDisruption[]
  ) => void | Promise<void>;
};

const QUALITIES: { value: number; label: string; emoji: string }[] = [
  { value: 5, label: 'Great', emoji: '😄' },
  { value: 4, label: 'Good', emoji: '😊' },
  { value: 3, label: 'Okay', emoji: '😐' },
  { value: 2, label: 'Poor', emoji: '😔' },
  { value: 1, label: 'Awful', emoji: '😩' },
];

const HOURS: { value: SleepHoursBucket; label: string }[] = [
  { value: 'lt5', label: '<5h' },
  { value: '5to6', label: '5–6h' },
  { value: '6to7', label: '6–7h' },
  { value: '7to8', label: '7–8h' },
  { value: 'gt8', label: '8+h' },
];

const DISRUPTIONS: { value: SleepDisruption; label: string }[] = [
  { value: 'night_sweats', label: 'Night sweats' },
  { value: 'hot_flashes', label: 'Hot flashes' },
  { value: 'cant_fall_asleep', label: "Couldn't fall asleep" },
  { value: 'woke_often', label: 'Woke often' },
  { value: 'woke_early', label: 'Woke too early' },
  { value: 'bathroom_trips', label: 'Bathroom trips' },
  { value: 'racing_mind', label: 'Racing mind' },
  { value: 'restless', label: 'Restless' },
];

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';

export function SleepLogSheet({
  open,
  initialQuality,
  initialHours,
  initialDisruptions,
  saving = false,
  onClose,
  onSave,
}: SleepLogSheetProps) {
  const [quality, setQuality] = useState<number | null>(null);
  const [hours, setHours] = useState<SleepHoursBucket | null>(null);
  const [disruptions, setDisruptions] = useState<SleepDisruption[]>([]);

  const initialDisruptionsKey = useMemo(
    () => (initialDisruptions ?? []).join(','),
    [initialDisruptions]
  );

  useEffect(() => {
    if (!open) return;
    setQuality(initialQuality ?? null);
    setHours(initialHours ?? null);
    setDisruptions(initialDisruptions ?? []);
  }, [open, initialQuality, initialHours, initialDisruptionsKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleDisruption = (value: SleepDisruption) => {
    setDisruptions((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (quality == null) return;
    await onSave(quality, hours, disruptions);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close sleep log"
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
          Sleep check-in
        </div>
        <h2
          className="mb-5 text-[20px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          How did you sleep?
        </h2>

        <div className="mb-6 grid grid-cols-5 gap-2">
          {QUALITIES.map((q) => {
            const selected = quality === q.value;
            return (
              <button
                key={q.value}
                type="button"
                onClick={() => setQuality(q.value)}
                aria-pressed={selected}
                className="flex flex-col items-center gap-1.5 rounded-[16px] bg-transparent px-1 py-2 outline-none transition-transform focus:outline-none focus-visible:outline-none"
                style={{
                  transform: selected ? 'scale(1.28)' : 'scale(1)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <img src={twemojiUrl(q.emoji)} alt={q.label} width={34} height={34} />
                <span
                  className={`text-[9px] uppercase tracking-[0.04em] ${selected ? 'text-on-surface' : 'text-outline'}`}
                  style={{ fontFamily: FONT_MONO }}
                >
                  {q.label}
                </span>
              </button>
            );
          })}
        </div>

        <p className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
          Hours slept <span className="text-outline">(optional)</span>
        </p>
        <div className="mb-6 flex flex-wrap gap-2">
          {HOURS.map((h) => {
            const selected = hours === h.value;
            return (
              <button
                key={h.value}
                type="button"
                onClick={() => setHours(selected ? null : h.value)}
                aria-pressed={selected}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  fontFamily: FONT_BODY,
                  backgroundColor: selected ? '#5E3566' : 'transparent',
                  color: selected ? '#FBF6F0' : '#3E2542',
                  borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                }}
              >
                {h.label}
              </button>
            );
          })}
        </div>

        <p className="mb-2.5 text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
          What disrupted it? <span className="text-outline">(optional)</span>
        </p>
        <div className="mb-7 flex flex-wrap gap-2">
          {DISRUPTIONS.map((d) => {
            const selected = disruptions.includes(d.value);
            return (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDisruption(d.value)}
                aria-pressed={selected}
                className="whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
                style={{
                  fontFamily: FONT_BODY,
                  backgroundColor: selected ? '#5E3566' : 'transparent',
                  color: selected ? '#FBF6F0' : '#3E2542',
                  borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={quality == null || saving}
          className="w-full rounded-full bg-primary py-3.5 text-[14px] font-medium text-surface transition-opacity active:opacity-80 disabled:opacity-40"
          style={{ fontFamily: FONT_BODY }}
        >
          {saving ? 'Saving…' : 'Save sleep'}
        </button>
      </div>
    </div>
  );
}
