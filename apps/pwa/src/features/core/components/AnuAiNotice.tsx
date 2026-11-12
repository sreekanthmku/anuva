import { useTranslation } from 'react-i18next';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';

const MULISH = { fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' };

/**
 * What ANU is and is not: an AI wellness companion, not a clinician, and not a crisis service.
 * Shown the first time she opens the chat on this device (until she taps "I understand") and any
 * time after from the chat's ⋯ menu. The crisis replies themselves are handled by ANU; this is the
 * up-front notice, wording from the legal and compliance review.
 */
export function AnuAiNotice({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[80] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="anu-ai-notice-title"
      aria-describedby="anu-ai-notice-body"
    >
      {/* Inert on purpose: she leaves through "I understand", so the notice is not missed by a stray tap. */}
      <div className="absolute inset-0 bg-[#3E2542]/60" aria-hidden />

      <div className="relative max-h-full w-full max-w-[360px] overflow-y-auto rounded-[24px] border border-border-default bg-surface-raised px-6 py-7 shadow-[0_18px_50px_rgba(94,53,102,0.24)]">
        <h2
          id="anu-ai-notice-title"
          className="text-[21px] leading-[1.25] text-on-surface"
          style={{ fontFamily: '"Fraunces", serif', fontWeight: 500 }}
        >
          {t('chat.aiNotice.title')}
        </h2>

        <p
          id="anu-ai-notice-body"
          className="mt-3 text-[13.5px] leading-[1.6] text-on-surface-variant"
          style={MULISH}
        >
          {t('chat.aiNotice.body')}
        </p>

        <p
          className="mt-3 rounded-[16px] bg-surface-container px-4 py-3 text-[13px] leading-[1.55] text-on-surface"
          style={MULISH}
        >
          {t('chat.aiNotice.crisis')}
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[48px] w-full rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary"
          style={MULISH}
        >
          {t('chat.aiNotice.ok')}
        </button>
      </div>
    </div>
  );
}

const SEEN_KEY_PREFIX = 'anuva.anuAiNotice.v1:';

/** Whether she has already acknowledged the notice on this device. Storage blocked → show it. */
export function hasSeenAnuAiNotice(userId: string | undefined): boolean {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(SEEN_KEY_PREFIX + userId) !== null;
  } catch {
    return false;
  }
}

export function markAnuAiNoticeSeen(userId: string | undefined): void {
  if (!userId) return;
  try {
    window.localStorage.setItem(SEEN_KEY_PREFIX + userId, new Date().toISOString());
  } catch {
    // Storage blocked: she sees it again next time, which is the safe side.
  }
}
