import { useEffect } from 'react';
import type { PeriodFlow } from '@anuva/shared';
import { formatCycleDateLong, todayISO } from './cycleTrackerDisplay';

type PeriodFlowSheetProps = {
  open: boolean;
  /** The bleeding day being asked about — not always today, missed days are backfilled. */
  date: string;
  /** Set when correcting an answer already given for this day. */
  initialFlow?: PeriodFlow | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (flow: PeriodFlow) => void | Promise<void>;
};

const FLOWS: { value: PeriodFlow; label: string; hint: string }[] = [
  { value: 'light', label: 'Light', hint: 'Spotting, or a liner is enough' },
  { value: 'regular', label: 'Regular', hint: 'Your usual flow' },
  { value: 'heavy', label: 'Heavy', hint: 'Changing more often than usual' },
];

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Mulish", sans-serif';
const SERIF = '"Fraunces", sans-serif';

export function PeriodFlowSheet({
  open,
  date,
  initialFlow,
  saving = false,
  onClose,
  onSave,
}: PeriodFlowSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isToday = date === todayISO();

  const handleSelect = async (flow: PeriodFlow) => {
    if (saving) return;
    await onSave(flow);
  };

  return (
    <div className="fixed inset-0 z-[72] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Close period check-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[360px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto', fontFamily: FONT_BODY }}
      >
        <div
          className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary"
          style={{ fontFamily: FONT_MONO }}
        >
          <span className="h-px w-3 bg-primary/60" />
          Period check-in
        </div>
        <h2
          className="mb-1.5 text-[20px] leading-snug text-on-surface"
          style={{ fontFamily: SERIF, fontWeight: 300 }}
        >
          How is your period feeling?
        </h2>
        {/* Named day when backfilling, so an answer is never given about the wrong day. */}
        <p className="mb-5 text-[12.5px] text-on-surface-variant">
          {isToday ? 'Today' : formatCycleDateLong(date)}
        </p>

        <div className="flex flex-col gap-2.5">
          {FLOWS.map((f) => {
            const selected = initialFlow === f.value;
            return (
              <button
                key={f.value}
                type="button"
                disabled={saving}
                aria-pressed={selected}
                onClick={() => handleSelect(f.value)}
                className="w-full rounded-[16px] border px-4 py-3 text-left transition-colors disabled:opacity-50"
                style={{
                  borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
                  backgroundColor: selected ? 'rgba(94, 53, 102, 0.10)' : 'transparent',
                }}
              >
                <span className="block text-[14.5px] font-medium text-on-surface">{f.label}</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-on-surface-variant">
                  {f.hint}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="mt-5 w-full py-2 text-[13px] text-on-surface-variant underline decoration-transparent disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
