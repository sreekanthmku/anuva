import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { MedicationReminder } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { BottomNav } from '../components/BottomNav';
import { fetchReminders, updateReminder } from './api';
import { reminderSummary } from './format';
import { PushReadiness } from './PushReadiness';
import { ReminderEditorSheet } from './ReminderEditorSheet';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/** Profile → Medication reminders: her reminders, each with a pause switch; tap one to change it. */
export default function MedicationRemindersRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<MedicationReminder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // `null` closed, 'new' for a new reminder, otherwise the one being edited.
  const [editing, setEditing] = useState<MedicationReminder | 'new' | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setReminders(await fetchReminders());
      setError(null);
    } catch {
      setError(t('medication.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (reminder: MedicationReminder) => {
    setToggling(reminder.id);
    try {
      const updated = await updateReminder(reminder.id, { active: !reminder.active });
      setReminders((prev) => prev?.map((r) => (r.id === updated.id ? updated : r)) ?? null);
    } catch {
      setError(t('medication.editor.saveFailed'));
    } finally {
      setToggling(null);
    }
  };

  const closeEditor = useCallback(() => setEditing(null), []);

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="min-h-11 bg-transparent p-0 text-[13px] text-on-surface-variant"
          style={{ fontFamily: FONT_BODY }}
        >
          {t('medication.back')}
        </button>
      </header>

      <section className="px-3 pb-6 pt-2" style={{ fontFamily: FONT_BODY }}>
        <Eyebrow>{t('medication.eyebrow')}</Eyebrow>
        <h1 className="font-display text-[24px] leading-tight text-on-surface">{t('medication.title')}</h1>
        <p className="mb-5 mt-1.5 text-[13px] text-on-surface-variant">{t('medication.intro')}</p>

        <PushReadiness />

        {error && <p className="mb-3 text-[12px] text-error">{error}</p>}

        {reminders && reminders.length === 0 && (
          <p className="mb-4 text-[13px] text-on-surface-variant">{t('medication.empty')}</p>
        )}

        {reminders && reminders.length > 0 && (
          <article className="mb-4 overflow-hidden rounded-[20px] border border-border-default bg-surface-raised">
            <ul className="divide-y divide-border-default">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setEditing(reminder)}
                    className="min-h-11 min-w-0 flex-1 text-left"
                  >
                    <span className={`block text-[14px] ${reminder.active ? 'text-on-surface' : 'text-outline'}`}>
                      {reminderSummary(t, reminder, i18n.language)}
                    </span>
                    {!reminder.active && (
                      <span className="text-[12px] text-on-surface-variant">{t('medication.paused')}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={reminder.active}
                    aria-label={t('medication.activeToggle')}
                    disabled={toggling === reminder.id}
                    onClick={() => void toggle(reminder)}
                    className="relative inline-flex h-11 w-14 shrink-0 items-center disabled:opacity-60"
                  >
                    <span
                      className={`h-7 w-12 rounded-full transition-colors ${reminder.active ? 'bg-primary' : 'bg-outline/40'}`}
                    />
                    <span
                      className={`absolute h-5 w-5 rounded-full bg-surface transition-transform ${
                        reminder.active ? 'translate-x-[26px]' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </article>
        )}

        {reminders && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="min-h-11 w-full rounded-full bg-secondary px-4 py-3 text-[14px] font-semibold text-on-secondary"
          >
            {t('medication.add')}
          </button>
        )}
      </section>

      <ReminderEditorSheet
        open={editing !== null}
        reminder={editing === 'new' ? null : editing}
        onClose={closeEditor}
        onSaved={() => void load()}
        onDeleted={(id) => setReminders((prev) => prev?.filter((r) => r.id !== id) ?? null)}
      />

      <BottomNav />
    </main>
  );
}
