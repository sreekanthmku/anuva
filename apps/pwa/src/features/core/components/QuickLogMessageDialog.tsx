import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { twemojiUrl } from '../../../shared/lib/twemoji';

type QuickLogMessageDialogProps = {
  open: boolean;
  message: string;
  emoji: string;
  caption: string;
  onClose: () => void;
};

const FONT_BODY = '"Geist", -apple-system, system-ui, sans-serif';
const FONT_MONO = '"Geist Mono", ui-monospace, monospace';

export function QuickLogMessageDialog({
  open,
  message,
  emoji,
  caption,
  onClose,
}: QuickLogMessageDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-label="Dismiss"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[340px] rounded-[24px] border border-border-default bg-surface-raised px-[22px] py-6 text-center shadow-xl"
      >
        {emoji && (
          <img
            src={twemojiUrl(emoji)}
            alt=""
            aria-hidden="true"
            width={72}
            height={72}
            className="mx-auto mb-3"
          />
        )}

        {caption && (
          <p
            className="mb-4 text-[11px] uppercase tracking-[0.1em] text-primary"
            style={{ fontFamily: FONT_MONO }}
          >
            {caption}
          </p>
        )}

        <span className="mx-auto mb-3 inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-primary" style={{ fontFamily: FONT_MONO }}>
          <Check size={10} strokeWidth={3} /> Logged
        </span>

        <p
          className="mb-6 text-[15px] leading-[1.5] text-on-surface"
          style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-full bg-primary py-3 text-[14px] font-medium text-surface transition-opacity active:opacity-80"
          style={{ fontFamily: FONT_BODY }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
