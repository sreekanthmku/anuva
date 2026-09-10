import { useEffect, useId, useState } from 'react';
import type { FamilySupportActionKind } from '@anuva/shared';
import { GIFT_KINDS, SUPPORT_ACTIONS, supportSheet } from '../data/labels';
import { twemojiUrl } from '../../shared/lib/twemoji';
import { PrimaryButton } from '../shell/ui';

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

/** The two that reach her phone as a picture. Both get the same big-preview treatment. */
function GiftPreview({ emoji, note, coming }: { emoji: string; note: string; coming: string }) {
  return (
    <div className="mt-4 flex items-center gap-4 rounded-[20px] border border-secondary/25 bg-secondary/10 px-4 py-4">
      <img
        src={twemojiUrl(emoji)}
        alt=""
        aria-hidden
        width={52}
        height={52}
        className="shrink-0"
        style={{ filter: 'drop-shadow(0 6px 12px rgba(94,53,102,0.2))' }}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold leading-snug text-on-surface">{note}</p>
        <p className="mt-1 text-[11.5px] leading-snug text-outline">{coming}</p>
      </div>
    </div>
  );
}

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
        className="absolute inset-0 animate-[anuvaFade_260ms_ease-out] bg-[#3E2542]/50 backdrop-blur-[3px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 max-h-[92svh] w-full max-w-[520px] animate-[anuvaSheetUp_320ms_cubic-bezier(0.16,1,0.3,1)] overflow-y-auto rounded-t-[30px] border-x border-t border-secondary/20 bg-surface-raised px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-20px_50px_-20px_rgba(94,53,102,0.4)]"
      >
        <div className="mx-auto mb-4 h-1.5 w-11 rounded-full bg-outline-variant" aria-hidden />

        <p className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-tertiary">
          {supportSheet.label}
        </p>
        <h2 id={titleId} className="mt-1 font-display text-[23px] font-medium leading-tight text-primary">
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
                className={`press min-h-[58px] rounded-[20px] border px-3.5 py-3 text-left text-[14px] font-semibold transition-colors ${
                  pressed
                    ? 'border-primary/40 bg-primary-fixed text-primary shadow-soft'
                    : 'border-border-default bg-surface-container-low text-on-surface'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {action.emoji ? (
                    <img
                      src={twemojiUrl(action.emoji)}
                      alt=""
                      aria-hidden
                      width={24}
                      height={24}
                      className="shrink-0"
                    />
                  ) : null}
                  <span className="leading-snug">{action.label}</span>
                </span>
                {done ? (
                  <span className="mt-1 block text-[11px] font-semibold text-success">
                    ✓ done today
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Composing only appears for a message: the other three are gestures, with nothing to type. */}
        {selected === 'message' ? (
          <div className="mt-4">
            <label className="block">
              <span className="text-[12px] font-bold text-on-surface">Write her a note</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value.slice(0, MAX_MESSAGE))}
                rows={3}
                placeholder="Thinking of you today."
                className="mt-1.5 w-full resize-none rounded-[18px] border border-border-default bg-surface-container-low px-4 py-3 text-[14.5px] leading-[1.55] text-on-surface placeholder:text-outline focus:border-secondary focus:ring-2 focus:ring-secondary/25"
              />
            </label>
            <div className="mt-1 flex items-center justify-between text-[11px] text-outline">
              <span>Arrives as a notification. Not saved anywhere.</span>
              <span className="tabular-nums">
                {text.length}/{MAX_MESSAGE}
              </span>
            </div>
          </div>
        ) : null}

        {/* The gifts are delivered, not just recorded — say what actually reaches her, and say what
            does not reach her yet, before the tap rather than in the toast afterwards. */}
        {isGift ? (
          <GiftPreview
            emoji={selectedAction?.emoji ?? '🌹'}
            note={supportSheet.giftNote}
            coming={supportSheet.giftComingSoon}
          />
        ) : null}

        <PrimaryButton
          className="mt-5"
          disabled={sending || (selected === 'message' && text.trim().length === 0)}
          onClick={() => {
            if (selected !== 'message') {
              onDone(selected);
              return;
            }
            setSending(true);
            void onSendMessage(text.trim()).finally(() => setSending(false));
          }}
        >
          {sending ? 'Sending…' : selected === 'message' ? 'Send note' : isGift ? 'Send it' : 'Done'}
          {/* The gift travels as its picture, not as its name — same on both phones. */}
          {!sending && isGift && selectedAction?.emoji ? (
            <img src={twemojiUrl(selectedAction.emoji)} alt="" aria-hidden width={20} height={20} />
          ) : null}
        </PrimaryButton>

        <button
          type="button"
          onClick={onRemindLater}
          className="mt-1.5 flex min-h-[46px] w-full items-center justify-center rounded-full px-5 text-[14px] font-semibold text-primary"
        >
          {supportSheet.remindLater}
        </button>
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-5"
      style={{ bottom: 'calc(104px + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="max-w-[520px] animate-[anuvaSheetUp_260ms_cubic-bezier(0.16,1,0.3,1)] rounded-[20px] bg-inverse-surface px-4 py-3 text-center text-[13px] font-medium leading-snug text-inverse-on-surface shadow-lift">
        {message}
      </div>
    </div>
  );
}
