import { useEffect, useId, useState } from 'react';
import type { FamilySupportActionKind } from '@anuva/shared';
import { GIFT_KINDS, SUPPORT_ACTIONS, supportSheet } from '../data/labels';
import { twemojiUrl } from '../../shared/lib/twemoji';

const MAX_MESSAGE = 280;

type Props = {
  open: boolean;
  /** Already taken today. Marked, but still selectable — re-tapping is idempotent server-side. */
  doneKinds: FamilySupportActionKind[];
  /** Sends a note as a push notification. Nothing is stored, so there is no thread to open. */
  onSendMessage: (text: string) => Promise<void>;
  onClose: () => void;
  /** Which action they chose — recorded server-side, so the kind has to travel with it. */
  onDone: (kind: FamilySupportActionKind) => void;
  onRemindLater: () => void;
};

export function SupportActionSheet({
  open,
  doneKinds,
  onClose,
  onDone,
  onSendMessage,
  onRemindLater,
}: Props) {
  const titleId = useId();
  const [selected, setSelected] = useState<FamilySupportActionKind>('message');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelected('message');
    setText('');
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectedAction = SUPPORT_ACTIONS.find((action) => action.id === selected);
  const isGift = GIFT_KINDS.includes(selected);

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
          {SUPPORT_ACTIONS.map((action) => {
            const pressed = selected === action.id;
            const done = doneKinds.includes(action.id);
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
                <span className="flex items-center gap-2">
                  {action.emoji ? (
                    <img
                      src={twemojiUrl(action.emoji)}
                      alt=""
                      aria-hidden
                      width={22}
                      height={22}
                      className="shrink-0"
                    />
                  ) : null}
                  <span className="leading-snug">{action.label}</span>
                </span>
                {done ? (
                  <span className="mt-0.5 block text-[11px] font-medium text-success">
                    ✓ done today
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Composing only appears for a message: the other three are gestures arranged elsewhere,
            with nothing to type. */}
        {selected === 'message' ? (
          <div className="mt-4">
            <label className="block">
              <span className="text-[12px] font-semibold text-on-surface">Write her a note</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE))}
                rows={3}
                placeholder="Thinking of you today."
                className="mt-1.5 w-full resize-none rounded-[16px] border border-border-default bg-surface-container-low px-3.5 py-3 text-[14px] leading-[1.5] text-on-surface"
              />
            </label>
            <div className="mt-1 flex items-center justify-between text-[11px] text-outline">
              <span>Arrives as a notification. Not saved anywhere.</span>
              <span>
                {text.length}/{MAX_MESSAGE}
              </span>
            </div>
          </div>
        ) : null}

        {/* The gifts are delivered, not just recorded — say what actually reaches her, and say what
            does not reach her yet, before the tap rather than in the toast afterwards. */}
        {isGift ? (
          <div className="mt-4 flex items-start gap-3 rounded-[18px] border border-secondary/25 bg-secondary/10 px-3.5 py-3">
            <img
              src={twemojiUrl(selectedAction?.emoji ?? '💐')}
              alt=""
              aria-hidden
              width={34}
              height={34}
              className="mt-0.5 shrink-0"
            />
            <div>
              <p className="text-[13px] font-semibold leading-snug text-on-surface">
                {supportSheet.giftNote}
              </p>
              <p className="mt-1 text-[11.5px] leading-snug text-outline">
                {supportSheet.giftComingSoon}
              </p>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          disabled={sending || (selected === 'message' && text.trim().length === 0)}
          onClick={() => {
            if (selected !== 'message') {
              onDone(selected);
              return;
            }
            setSending(true);
            void onSendMessage(text.trim()).finally(() => setSending(false));
          }}
          className="mt-5 flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[15px] font-semibold text-on-secondary shadow-[0_8px_20px_rgba(201,126,146,0.28)] disabled:opacity-60"
        >
          {sending
            ? 'Sending…'
            : selected === 'message'
              ? 'Send note'
              : isGift
                ? `Send ${selectedAction?.emoji ?? ''}`.trim()
                : 'Done'}
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
