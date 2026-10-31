import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteAiConsent } from '@anuva/shared';
import { grantAiConsent } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * Asked once, before her first voice or photo note: what leaves the phone, who processes it, what
 * is kept. The wording here is versioned (`NOTE_AI_CONSENT_VERSION`); change it materially and bump
 * the version, so everyone who agreed to the old text is asked again.
 */
export function NoteAiConsentPanel({
  onGranted,
  onDecline,
}: {
  onGranted: (consent: NoteAiConsent) => void;
  onDecline: () => void;
}) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    setSaving(true);
    setError(null);
    try {
      onGranted(await grantAiConsent());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <div style={{ fontFamily: FONT_BODY }}>
      <h2 className="font-display text-[22px] leading-tight text-on-surface">{t('notes.aiConsent.title')}</h2>
      <div className="mt-3 flex flex-col gap-2.5 text-[13.5px] leading-[1.55] text-on-surface-variant">
        <p>{t('notes.aiConsent.what')}</p>
        <p>{t('notes.aiConsent.kept')}</p>
        <p>{t('notes.aiConsent.choice')}</p>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-error">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void agree()}
        className="mt-5 min-h-11 w-full rounded-full bg-secondary px-5 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-50"
      >
        {saving ? t('notes.saving') : t('notes.aiConsent.agree')}
      </button>
      <button
        type="button"
        onClick={onDecline}
        className="mt-2 min-h-11 w-full rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-on-surface-variant"
      >
        {t('notes.aiConsent.notNow')}
      </button>
    </div>
  );
}
