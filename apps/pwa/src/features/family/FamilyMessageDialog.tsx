import type { FamilyMessage } from './familyMessageLink';

/**
 * The note, shown once. There is no inbox behind this — dismissing it is the end of the message,
 * which is why the dismiss control says so plainly rather than looking like a close button on
 * something she could come back to.
 */
export function FamilyMessageDialog({
  message,
  onDismiss,
}: {
  message: FamilyMessage | null;
  onDismiss: () => void;
}) {
  if (!message) return null;

  const mulish = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-message-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#3E2542]/60"
        aria-label="Dismiss message"
        onClick={onDismiss}
      />

      <div className="relative w-full max-w-[340px] rounded-[24px] border border-secondary/30 bg-surface-raised px-6 py-7 text-center shadow-[0_18px_50px_rgba(94,53,102,0.24)]">
        <span
          aria-hidden
          className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-secondary/15 text-[19px] text-secondary"
        >
          ♥
        </span>

        <p
          id="family-message-title"
          className="mt-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-tertiary"
          style={mulish}
        >
          {message.from} says
        </p>

        <blockquote
          className="mt-3 text-[18px] leading-[1.5] text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 400 }}
        >
          “{message.text}”
        </blockquote>

        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 min-h-[46px] w-full rounded-full bg-secondary px-5 text-[14px] font-semibold text-on-secondary"
          style={mulish}
        >
          Close
        </button>
        <p className="mt-2 text-[11px] text-outline" style={mulish}>
          Notes are not saved — this one closes for good.
        </p>
      </div>
    </div>
  );
}
