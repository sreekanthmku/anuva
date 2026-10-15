import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { HealthNote, NoteAiConsent } from '@anuva/shared';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { BottomNav } from '../components/BottomNav';
import { deleteNote, fetchAiConsent, fetchNotes, withdrawAiConsent } from './api';
import { NoteComposerSheet } from './NoteComposerSheet';
import { NoteForDoctorBar } from './NoteForDoctorBar';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

function writtenOn(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Her notes: everything she has jotted down, which doctor has seen which, and her AI consent. */
export default function NotesRoute() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<HealthNote[] | null>(null);
  const [consent, setConsent] = useState<NoteAiConsent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<HealthNote | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, aiConsent] = await Promise.all([fetchNotes(), fetchAiConsent()]);
      setNotes(list);
      setConsent(aiConsent);
      setError(null);
    } catch {
      setError(t('notes.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (note: HealthNote) => {
    setBusy(true);
    try {
      await deleteNote(note.id);
      setNotes((current) => current?.filter((n) => n.id !== note.id) ?? null);
      setConfirmingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const turnOffAi = async () => {
    setBusy(true);
    try {
      setConsent(await withdrawAiConsent());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface"
      style={{ fontFamily: FONT_BODY }}
    >
      <header className="sticky top-0 z-30 bg-surface px-3 pb-3 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="min-h-11 bg-transparent p-0 text-[13px] text-on-surface-variant"
        >
          {t('notes.back')}
        </button>
        <Eyebrow>{t('notes.eyebrow')}</Eyebrow>
        <h1 className="font-display text-[30px] leading-[1.1] text-primary">{t('notes.title')}</h1>
        <p className="mt-2 max-w-[34ch] text-[13.5px] leading-[1.55] text-on-surface-variant">{t('notes.intro')}</p>
      </header>

      <NoteForDoctorBar onSaved={() => void load()} />

      <section className="px-3 pt-4">
        {error ? <p className="mb-3 text-[13px] text-error">{error}</p> : null}
        {notes === null && !error ? <p className="text-[13.5px] text-on-surface-variant">{t('notes.loading')}</p> : null}
        {notes?.length === 0 ? <p className="text-[13.5px] text-on-surface-variant">{t('notes.empty')}</p> : null}

        <ul className="flex flex-col gap-3">
          {notes?.map((note) => (
            <li key={note.id} className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4">
              <div className="flex items-center justify-between gap-2 text-[11.5px] text-on-surface-variant">
                <span>
                  {t(`notes.source.${note.source}`)} · {writtenOn(note.createdAt, i18n.language)}
                </span>
                {note.status !== 'ready' ? (
                  <span className="rounded-full bg-tertiary-container px-2.5 py-0.5 font-semibold text-on-tertiary-container">
                    {note.status === 'failed' ? t('notes.notReadBadge') : t('notes.checkBadge')}
                  </span>
                ) : null}
              </div>

              {note.body ? (
                <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-[1.5] text-on-surface">{note.body}</p>
              ) : null}

              {note.shares.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {note.shares.map((share) => (
                    <span
                      key={share.consultationId}
                      className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-[11.5px] font-semibold text-primary"
                    >
                      {t('notes.sharedWith', { name: share.specialistName })}
                    </span>
                  ))}
                </div>
              ) : null}

              {confirmingDelete === note.id ? (
                <div className="mt-3 rounded-[14px] bg-surface-container-low px-3 py-3">
                  <p className="text-[13px] text-on-surface">{t('notes.deleteConfirm')}</p>
                  {note.shares.some((share) => !share.canRevoke) ? (
                    <p className="mt-1 text-[12px] text-on-surface-variant">{t('notes.deleteKeptByDoctor')}</p>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove(note)}
                      className="min-h-11 flex-1 rounded-full border border-error/40 px-3 py-2 text-[13px] font-semibold text-error disabled:opacity-45"
                    >
                      {t('notes.delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(null)}
                      className="min-h-11 flex-1 rounded-full border border-border-default px-3 py-2 text-[13px] font-semibold"
                    >
                      {t('notes.keep')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-4 text-[13px] font-semibold">
                  <button type="button" onClick={() => setEditing(note)} className="min-h-9 text-primary">
                    {note.status === 'ready' ? t('notes.edit') : t('notes.check')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(note.id)}
                    className="min-h-9 text-on-surface-variant"
                  >
                    {t('notes.delete')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {consent ? (
        <section className="px-3 pt-6">
          <div className="rounded-[16px] bg-surface-container-low px-4 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
            <p className="font-semibold text-on-surface">
              {consent.granted ? t('notes.aiConsent.statusOn') : t('notes.aiConsent.statusOff')}
            </p>
            <p className="mt-0.5">{consent.granted ? t('notes.aiConsent.statusOnHint') : t('notes.aiConsent.statusOffHint')}</p>
            {consent.granted ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void turnOffAi()}
                className="mt-1 min-h-9 font-semibold text-primary disabled:opacity-45"
              >
                {t('notes.aiConsent.turnOff')}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {editing ? (
        <NoteComposerSheet
          mode={editing.source}
          editing={editing}
          onClose={() => {
            setEditing(null);
            void load();
          }}
          onSaved={(saved) => {
            setEditing(null);
            setNotes((current) => current?.map((n) => (n.id === saved.id ? saved : n)) ?? null);
          }}
        />
      ) : null}

      <BottomNav />
    </main>
  );
}
