import { useEffect, useId, useState } from 'react';
import {
  supportActions,
  supportSheet,
  type SupportActionId,
} from '../data/dummy';

type Props = {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  onRemindLater: () => void;
};

export function SupportActionSheet({ open, onClose, onDone, onRemindLater }: Props) {
  const titleId = useId();
  const [selected, setSelected] = useState<SupportActionId>('message');

  useEffect(() => {
    if (!open) return;
    setSelected('message');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/45 backdrop-blur-[2px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-[560px] animate-[sheetUp_280ms_ease-out] rounded-t-[28px] border border-border-default bg-surface-raised px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_40px_rgba(94,53,102,0.12)]"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline-variant" aria-hidden />
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-tertiary">
          {supportSheet.label}
        </p>
        <h2 id={titleId} className="mt-1 font-display text-[22px] leading-tight text-on-surface">
          {supportSheet.headline}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-2.5" role="group" aria-label="Support actions">
          {supportActions.map((action) => {
            const pressed = selected === action.id;
            return (
              <button
                key={action.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => setSelected(action.id)}
                className={`min-h-[52px] rounded-[18px] border px-3 py-3 text-left text-[14px] font-semibold transition-colors ${
                  pressed
                    ? 'border-primary bg-primary-fixed text-primary'
                    : 'border-border-default bg-surface-container-low text-on-surface'
                }`}
              >
                {action.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onDone}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary shadow-[0_8px_20px_rgba(201,126,146,0.28)]"
        >
          {supportSheet.done}
        </button>
        <button
          type="button"
          onClick={onRemindLater}
          className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold text-primary"
        >
          {supportSheet.remindLater}
        </button>
      </div>

      <style>{`
        @keyframes sheetUp {
          from { transform: translateY(18px); opacity: 0.85; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-[560px] animate-[toastIn_240ms_ease-out] rounded-full bg-inverse-surface px-4 py-3 text-center text-[13px] font-medium leading-snug text-inverse-on-surface shadow-[0_12px_28px_rgba(62,37,66,0.28)]">
        {message}
      </div>
      <style>{`
        @keyframes toastIn {
          from { transform: translateY(8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
