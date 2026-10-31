import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MEDICATION_MAX_TIMES,
  type MedicationDays,
  type MedicationKind,
  type MedicationReminder,
} from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';
import { createReminder, deleteReminder, deviceTimeZone, updateReminder } from './api';
import { WEEK_ORDER, weekdayName } from './format';
import { PushReadiness } from './PushReadiness';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';
const DEFAULT_TIME = '09:00';
const DAY_OPTIONS: MedicationDays[] = ['daily', 'weekdays', 'alternate'];
const KINDS: MedicationKind[] = ['medication', 'supplement'];

function Chip({
  selected,
  radio = false,
  onClick,
  children,
}: {
  selected: boolean;
  /** One choice of several (inside a `radiogroup`) rather than a day she can add or remove. */
  radio?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      role={radio ? 'radio' : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={radio ? undefined : selected}
      className="min-h-11 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors"
      style={{
        fontFamily: FONT_BODY,
        backgroundColor: selected ? '#5E3566' : 'transparent',
        color: selected ? '#FBF6F0' : '#3E2542',
        borderColor: selected ? '#5E3566' : 'rgba(180, 159, 176, 0.35)',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Set up or change one reminder. No name field on purpose — only whether it is a medication or a
 * supplement, and even that is optional. She saves it herself; this is also what ANU's "Set a
 * reminder" button opens.
 */
export function ReminderEditorSheet({
  open,
  reminder,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  /// Null for a new reminder.
  reminder: MedicationReminder | null;
  onClose: () => void;
  onSaved: (reminder: MedicationReminder) => void;
  onDeleted?: (id: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [kind, setKind] = useState<MedicationKind | null>(null);
  const [times, setTimes] = useState<string[]>([DEFAULT_TIME]);
  const [days, setDays] = useState<MedicationDays>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogA11y<HTMLDivElement>(open, onClose);
  const fieldId = useId();

  useEffect(() => {
    if (!open) return;
    setKind(reminder?.kind ?? null);
    setTimes(reminder?.times.length ? reminder.times : [DEFAULT_TIME]);
    setDays(reminder?.days ?? 'daily');
    setWeekdays(reminder?.weekdays ?? []);
    setError(null);
  }, [open, reminder]);


  if (!open) return null;

  const uniqueTimes = [...new Set(times.filter(Boolean))].sort();
  const canSave = uniqueTimes.length > 0 && (days !== 'weekdays' || weekdays.length > 0) && !saving;

  const setTime = (index: number, value: string) => setTimes((prev) => prev.map((time, i) => (i === index ? value : time)));
  const toggleWeekday = (day: number) =>
    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const body = {
      kind,
      times: uniqueTimes,
      days,
      weekdays: days === 'weekdays' ? weekdays : [],
      timeZone: deviceTimeZone(),
    };
    try {
      onSaved(reminder ? await updateReminder(reminder.id, body) : await createReminder(body));
      onClose();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 400 ? e.message : t('medication.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!reminder) return;
    setSaving(true);
    setError(null);
    try {
      await deleteReminder(reminder.id);
      onDeleted?.(reminder.id);
      onClose();
    } catch {
      setError(t('medication.editor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={t('common.close')} />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reminder-editor-title"
        className="relative w-full max-w-[380px] rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6"
        style={{ maxHeight: '88dvh', overflowY: 'auto', fontFamily: FONT_BODY }}
      >
        <div className="mb-1 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
          <span aria-hidden="true" className="h-px w-3 bg-primary/60" />
          {t('medication.editor.eyebrow')}
        </div>
        <h2
          id="reminder-editor-title"
          className="mb-5 text-[20px] text-on-surface"
          style={{ fontFamily: '"Fraunces", sans-serif', fontWeight: 300 }}
        >
          {reminder ? t('medication.editor.editTitle') : t('medication.editor.newTitle')}
        </h2>

        <PushReadiness />

        <p id={`${fieldId}-kind`} className="mb-2.5 text-[12px] text-on-surface-variant">
          {t('medication.editor.kindQuestion')} <span className="text-outline">{t('medication.editor.optional')}</span>
        </p>
        {/* One answer or none: tapping the chosen one again clears it. */}
        <div className="mb-6 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${fieldId}-kind`}>
          {KINDS.map((value) => (
            <Chip key={value} radio selected={kind === value} onClick={() => setKind(kind === value ? null : value)}>
              {t(`medication.kind.${value}`)}
            </Chip>
          ))}
        </div>

        <p className="mb-2.5 text-[12px] text-on-surface-variant">
          {t('medication.editor.times')}{' '}
          <span className="text-outline">{t('medication.editor.maxTimes', { count: MEDICATION_MAX_TIMES })}</span>
        </p>
        <div className="mb-2 flex flex-col gap-2">
          {times.map((time, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(index, e.target.value)}
                aria-label={t('medication.editor.timeLabel', { number: index + 1 })}
                className="min-h-11 flex-1 rounded-[14px] border border-border-default bg-surface px-3 text-[15px] text-on-surface"
              />
              {times.length > 1 && (
                <button
                  type="button"
                  onClick={() => setTimes((prev) => prev.filter((_, i) => i !== index))}
                  aria-label={t('medication.editor.removeTime')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border-default text-on-surface-variant"
                >
                  <span aria-hidden="true">×</span>
                </button>
              )}
            </div>
          ))}
        </div>
        {times.length < MEDICATION_MAX_TIMES && (
          <button
            type="button"
            onClick={() => setTimes((prev) => [...prev, ''])}
            className="mb-6 min-h-11 text-[13px] font-semibold text-primary"
          >
            <span aria-hidden="true">+</span> {t('medication.editor.addTime')}
          </button>
        )}

        <p id={`${fieldId}-days`} className="mb-2.5 mt-2 text-[12px] text-on-surface-variant">
          {t('medication.editor.days')}
        </p>
        <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${fieldId}-days`}>
          {DAY_OPTIONS.map((value) => (
            <Chip key={value} radio selected={days === value} onClick={() => setDays(value)}>
              {t(`medication.editor.dayOptions.${value}`)}
            </Chip>
          ))}
        </div>
        {days === 'weekdays' && (
          <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-labelledby={`${fieldId}-days`}>
            {WEEK_ORDER.map((day) => (
              <Chip key={day} selected={weekdays.includes(day)} onClick={() => toggleWeekday(day)}>
                {weekdayName(day, i18n.language)}
              </Chip>
            ))}
          </div>
        )}
        {days === 'weekdays' && weekdays.length === 0 && (
          <p className="mb-2 text-[12px] text-on-surface-variant">{t('medication.editor.pickDays')}</p>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[12px] text-error">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="min-h-11 w-full rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-50"
          >
            {saving ? t('medication.editor.saving') : t('medication.editor.save')}
          </button>
          {reminder && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={saving}
              className="min-h-11 w-full rounded-full border border-border-default px-4 py-3 text-[13px] text-on-surface-variant disabled:opacity-50"
            >
              {t('medication.editor.delete')}
            </button>
          )}
          <button type="button" onClick={onClose} className="min-h-11 text-[13px] text-on-surface-variant underline">
            {t('medication.editor.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
