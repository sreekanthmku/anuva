import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { FamilyMissedResponse } from '@anuva/shared';
import { useDialogA11y } from '../../lib/a11y/useDialogA11y';
import { enablePushNotifications } from '../../lib/firebase';
import { clearNotificationPromptDismissed } from '../../lib/notifications/notificationPrompt';
import type { PushReadiness } from '../../lib/notifications/pushReadiness';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

type Props = {
  open: boolean;
  items: FamilyMissedResponse['items'];
  readiness: PushReadiness;
  onClose: () => void;
};

/** "You missed something from your family" — and the one tap that stops it happening again. */
export function MissedFamilyDialog({ open, items, readiness, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  // One line per person and kind: three notes from Mum today is still "Mum sent you a message".
  const lines = [
    ...new Map(items.map((item) => [`${item.memberFirstName}|${item.kind}`, item])).values(),
  ];
  const names = [...new Set(items.map((item) => item.memberFirstName))];
  const title =
    names.length === 1
      ? t('family.missed.titleOne', { name: names[0] })
      : t('family.missed.titleMany');

  const turnOn = async () => {
    setBusy(true);
    try {
      clearNotificationPromptDismissed();
      await enablePushNotifications();
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-[calc(var(--bottom-nav-height)+16px)] pt-4 sm:items-center sm:pb-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label={t('common.close')}
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-missed-title"
        className="relative w-full max-w-[360px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-5"
        style={{ fontFamily: FONT_BODY }}
      >
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[18px]">
          <span aria-hidden="true">💌</span>
        </div>
        <h2
          id="family-missed-title"
          className="mb-2 text-[20px] leading-tight text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 400 }}
        >
          {title}
        </h2>
        <ul className="mb-3 space-y-1 text-[14px] text-on-surface">
          {lines.map((item) => (
            <li key={`${item.memberFirstName}|${item.kind}`}>
              {t(`family.missed.${item.kind}`, { name: item.memberFirstName })}
            </li>
          ))}
        </ul>
        <p className="mb-5 text-[13px] leading-relaxed text-on-surface-variant">
          {t('family.missed.body')}
        </p>
        <div className="flex flex-col gap-2">
          {readiness === 'blocked' ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate('/profile');
              }}
              className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary"
            >
              {t('family.missed.showHow')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void turnOn()}
              disabled={busy}
              className="inline-flex w-full items-center justify-center rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-60"
            >
              {t('notificationPrompt.enable')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-[13px] font-medium text-on-surface-variant"
          >
            {t('notificationPrompt.notNow')}
          </button>
        </div>
      </div>
    </div>
  );
}
