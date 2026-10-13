import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { fetchReminders } from '../medication/api';
import { ReminderEditorSheet } from '../medication/ReminderEditorSheet';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * The "Set a reminder" button an ANU v3 reply offers. ANU only chose to show it: she sets the times
 * in the same editor as Profile and saves it herself. If she already has reminders, it opens her
 * list instead, so a second tap never quietly creates a duplicate.
 */
export function ReminderOffer() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editorOpen, setEditorOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);

  const open = async () => {
    setChecking(true);
    try {
      const existing = await fetchReminders();
      if (existing.length > 0) navigate('/profile/reminders');
      else setEditorOpen(true);
    } catch {
      // Could not tell — the editor is still the right place to start.
      setEditorOpen(true);
    } finally {
      setChecking(false);
    }
  };

  const closeEditor = useCallback(() => setEditorOpen(false), []);

  if (saved) {
    return (
      <button
        type="button"
        onClick={() => navigate('/profile/reminders')}
        className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary"
        style={{ fontFamily: FONT_BODY }}
      >
        ✓ {t('chat.reminder.set')} →
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={checking}
        className="min-h-11 rounded-full border border-primary/30 bg-surface px-4 py-2 text-[13px] font-semibold text-primary disabled:opacity-60"
        style={{ fontFamily: FONT_BODY }}
      >
        {t('chat.reminder.button')}
      </button>
      <ReminderEditorSheet
        open={editorOpen}
        reminder={null}
        onClose={closeEditor}
        onSaved={() => setSaved(true)}
      />
    </>
  );
}
