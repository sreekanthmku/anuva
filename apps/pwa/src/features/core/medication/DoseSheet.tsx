import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MEDICATION_SNOOZE_MINUTES, type MedicationDose, type MedicationDoseAction } from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';
import { fetchDose, respondToDose } from './api';
import { formatReminderTime } from './format';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * What a reminder notification opens: Taken, Snooze or Skip. The same card works on every phone —
 * buttons inside the notification itself are not available to an iPhone home-screen app.
 */
export function DoseSheet({
  doseId,
  onClose,
  onAnswered,
}: {
  doseId: string;
  onClose: () => void;
  /// With the toast to show once she has answered.
  onAnswered: (message: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [dose, setDose] = useState<MedicationDose | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

  useEffect(() => {
    let cancelled = false;
    fetchDose(doseId)
      .then((loaded) => {
        if (!cancelled) setDose(loaded);
      })
      .catch(() => {
        if (!cancelled) setError(t('medication.dose.notFound'));
      });
    return () => {
      cancelled = true;
    };
  }, [doseId, t]);

  const respond = async (action: MedicationDoseAction) => {
    setBusy(true);
    setError(null);
    try {
      await respondToDose(doseId, action);
      onAnswered(
        action === 'taken'
          ? t('medication.dose.takenDone')
          : action === 'skipped'
            ? t('medication.dose.skippedDone')
            : t('medication.dose.snoozedDone', { count: MEDICATION_SNOOZE_MINUTES }),
      );
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? e.message : t('medication.dose.failed'));
    } finally {
      setBusy(false);
    }
  };

  const answered = dose && dose.status !== 'pending';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-4 pb-[calc(var(--bottom-nav-height)+16px)] pt-4 sm:items-center sm:pb-4">
      <button type="button" className="absolute inset-0 bg-black/55" onClick={onClose} aria-label={t('common.close')} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dose-sheet-title"
        aria-busy={(!dose && !error) || undefined}
        className="relative w-full max-w-[360px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-5"
        style={{ fontFamily: FONT_BODY }}
      >
        <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
          <span aria-hidden="true" className="h-px w-3 bg-primary/60" />
          {t('medication.dose.eyebrow')}
        </div>
        <h2
          id="dose-sheet-title"
          className="text-[20px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          {t(`medication.dose.title.${dose?.kind ?? 'none'}`)}
        </h2>
        {!dose && !error && (
          <p role="status" className="sr-only">
            {t('common.loading')}
          </p>
        )}
        {dose && (
          <p className="mt-1 text-[13px] text-on-surface-variant">
            {t('medication.dose.scheduled', { time: formatReminderTime(dose.time, i18n.language) })}
            {answered ? ` · ${t(`medication.dose.status.${dose.status}`)}` : ''}
          </p>
        )}

        {dose && dose.answerable && (
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void respond('taken')}
              disabled={busy}
              className="min-h-11 w-full rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-60"
            >
              {t('medication.dose.taken')}
            </button>
            <div className="flex gap-2">
              {dose.status === 'pending' && (
                <button
                  type="button"
                  onClick={() => void respond('snooze')}
                  disabled={busy}
                  className="min-h-11 flex-1 rounded-full border border-primary/30 px-4 text-[13px] font-semibold text-primary disabled:opacity-60"
                >
                  {t('medication.dose.snooze', { count: MEDICATION_SNOOZE_MINUTES })}
                </button>
              )}
              <button
                type="button"
                onClick={() => void respond('skipped')}
                disabled={busy}
                className="min-h-11 flex-1 rounded-full border border-border-default px-4 text-[13px] text-on-surface disabled:opacity-60"
              >
                {t('medication.dose.skip')}
              </button>
            </div>
          </div>
        )}
        {dose && !dose.answerable && <p className="mt-4 text-[13px] text-on-surface">{t('medication.dose.earlierDay')}</p>}

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-error">
            {error}
          </p>
        )}

        <button type="button" onClick={onClose} className="mt-3 min-h-11 w-full text-[13px] text-on-surface-variant underline">
          {t('medication.dose.close')}
        </button>
      </div>
    </div>
  );
}
