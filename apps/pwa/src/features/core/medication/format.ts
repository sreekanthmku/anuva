import type { TFunction } from 'i18next';
import type { MedicationKind, MedicationReminder } from '@anuva/shared';

/// "08:00" → "8:00 am", in the app's language.
export function formatReminderTime(time: string, language: string): string {
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit' });
}

/// 0 = Sunday … 6 = Saturday, as short names in the app's language. 7 Jan 2024 was a Sunday.
export function weekdayName(day: number, language: string): string {
  return new Date(2024, 0, 7 + day).toLocaleDateString(language, { weekday: 'short' });
}

/// Monday first, as a week reads.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function kindLabel(t: TFunction, kind: MedicationKind | null): string {
  return t(`medication.kind.${kind ?? 'none'}`);
}

export function daysLabel(t: TFunction, reminder: Pick<MedicationReminder, 'days' | 'weekdays'>, language: string): string {
  if (reminder.days === 'weekdays') {
    return WEEK_ORDER.filter((day) => reminder.weekdays.includes(day))
      .map((day) => weekdayName(day, language))
      .join(', ');
  }
  return t(`medication.days.${reminder.days}`);
}

/// "Supplement · 8:00 am, 9:00 pm · Every day"
export function reminderSummary(t: TFunction, reminder: MedicationReminder, language: string): string {
  return [
    kindLabel(t, reminder.kind),
    reminder.times.map((time) => formatReminderTime(time, language)).join(', '),
    daysLabel(t, reminder, language),
  ].join(' · ');
}
