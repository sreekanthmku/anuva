import type {
  CreateMedicationReminderBody,
  MedicationDose,
  MedicationDoseAction,
  MedicationDosesResponse,
  MedicationReminder,
  MedicationRemindersResponse,
  UpdateMedicationReminderBody,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchReminders(): Promise<MedicationReminder[]> {
  return (await apiFetch<MedicationRemindersResponse>('/api/medication/reminders')).reminders;
}

export async function createReminder(body: CreateMedicationReminderBody): Promise<MedicationReminder> {
  return apiFetch<MedicationReminder>('/api/medication/reminders', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateReminder(id: string, body: UpdateMedicationReminderBody): Promise<MedicationReminder> {
  return apiFetch<MedicationReminder>(`/api/medication/reminders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteReminder(id: string): Promise<void> {
  await apiFetch<null>(`/api/medication/reminders/${id}`, { method: 'DELETE' });
}

export async function fetchTodayDoses(): Promise<MedicationDose[]> {
  return (await apiFetch<MedicationDosesResponse>('/api/medication/doses/today')).doses;
}

export async function fetchDose(id: string): Promise<MedicationDose> {
  return apiFetch<MedicationDose>(`/api/medication/doses/${id}`);
}

export async function respondToDose(id: string, action: MedicationDoseAction): Promise<MedicationDose> {
  return apiFetch<MedicationDose>(`/api/medication/doses/${id}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}

/// The phone's own zone, so 08:00 means 08:00 where she is.
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}
