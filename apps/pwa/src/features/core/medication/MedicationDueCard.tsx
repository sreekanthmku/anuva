import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MedicationDose } from '@anuva/shared';
import { fetchTodayDoses } from './api';
import { formatReminderTime, kindLabel } from './format';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * Reminders sent today that she has not answered. Shown only while there is one — so a reminder she
 * swiped away is still one tap from "Taken".
 */
export function MedicationDueCard({ refreshKey, onOpen }: { refreshKey: number; onOpen: (doseId: string) => void }) {
  const { t, i18n } = useTranslation();
  const [doses, setDoses] = useState<MedicationDose[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchTodayDoses()
      .then((loaded) => {
        if (!cancelled) setDoses(loaded);
      })
      .catch(() => {
        // The card is a convenience; the notification and the dose card still work without it.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (doses.length === 0) return null;

  return (
    <article
      className="mb-4 rounded-[20px] border border-primary/25 bg-surface-raised px-4 py-3.5"
      style={{ fontFamily: FONT_BODY }}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-tertiary">{t('medication.due.eyebrow')}</p>
      <ul className="flex flex-col gap-1.5">
        {doses.map((dose) => (
          <li key={dose.id}>
            <button
              type="button"
              onClick={() => onOpen(dose.id)}
              className="flex min-h-11 w-full items-center justify-between gap-3 rounded-full border border-primary/20 bg-surface px-4 py-2 text-left"
            >
              <span className="text-[14px] text-on-surface">
                {kindLabel(t, dose.kind)} · {formatReminderTime(dose.time, i18n.language)}
              </span>
              <span className="text-[13px] font-semibold text-primary">{t('medication.due.answer')}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
