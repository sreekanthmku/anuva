import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ConsultationSharedNote, HealthNote } from '@anuva/shared';
import { announce } from '../../../lib/a11y/announce';
import { LogSheetFrame } from '../components/LogSheetFrame';
import { fetchNotes, fetchSharedNotes, shareNotes, unshareNote } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * Choosing which notes one doctor sees. Nothing is ticked for her: every note shared is one she
 * picked, under a notice that says what the doctor gets and what she can take back. The wording is
 * versioned (`NOTE_SHARE_CONSENT_VERSION`) and recorded on every share.
 */
export function ShareNotesSheet({
  consultationId,
  specialistName,
  onClose,
  onChanged,
}: {
  consultationId: string;
  specialistName: string;
  onClose: () => void;
  onChanged?: (sharedCount: number) => void;
}) {
  const { t } = useTranslation();
  const [notes, setNotes] = useState<HealthNote[] | null>(null);
  const [shared, setShared] = useState<ConsultationSharedNote[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sharedLabelId = useId();
  const chooseLabelId = useId();

  const load = useCallback(async () => {
    try {
      const [mine, already] = await Promise.all([fetchNotes(), fetchSharedNotes(consultationId)]);
      setNotes(mine);
      setShared(already);
      setError(null);
    } catch {
      setError(t('notes.loadFailed'));
    }
  }, [consultationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const sharedIds = new Set(shared.map((note) => note.noteId));
  const choosable = (notes ?? []).filter((note) => note.status === 'ready' && !sharedIds.has(note.id));
  const unchecked = (notes ?? []).filter((note) => note.status !== 'ready').length;

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const share = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await shareNotes(consultationId, [...picked]);
      setShared(result);
      setPicked(new Set());
      onChanged?.(result.length);
      announce(t('a11y.care.notesShared', { count: picked.size, name: specialistName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async (noteId: string) => {
    setBusy(true);
    setError(null);
    try {
      await unshareNote(consultationId, noteId);
      const remaining = shared.filter((note) => note.noteId !== noteId);
      setShared(remaining);
      onChanged?.(remaining.length);
      announce(t('a11y.care.noteTakenBack'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('notes.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <LogSheetFrame onClose={onClose} closeLabel={t('notes.close')} fontFamily={FONT_BODY} maxWidthClass="max-w-[400px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{t('notes.eyebrow')}</p>
      <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">
        {t('notes.share.title', { name: specialistName })}
      </h2>

      {notes === null && !error ? (
        <p role="status" className="mt-4 text-[13.5px] text-on-surface-variant">
          {t('notes.loading')}
        </p>
      ) : null}

      {shared.length > 0 ? (
        <div className="mt-4">
          <p id={sharedLabelId} className="text-[12px] font-semibold text-on-surface-variant">
            {t('notes.share.alreadyShared')}
          </p>
          <ul aria-labelledby={sharedLabelId} className="mt-2 flex flex-col gap-2">
            {shared.map((note) => (
              <li key={note.noteId} className="rounded-[14px] bg-primary-fixed px-3 py-2.5">
                <p id={`shared-note-${note.noteId}`} className="line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-snug text-on-surface">
                  {note.body || t('notes.photoOnly')}
                </p>
                {note.canRevoke ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void takeBack(note.noteId)}
                    aria-describedby={`shared-note-${note.noteId}`}
                    className="mt-1 min-h-9 text-[12.5px] font-semibold text-primary disabled:opacity-45"
                  >
                    {t('notes.share.takeBack')}
                  </button>
                ) : (
                  <p className="mt-1 text-[11.5px] text-on-surface-variant">{t('notes.share.locked')}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {notes !== null && choosable.length === 0 && shared.length === 0 ? (
        <div className="mt-4 text-[13.5px] leading-[1.5] text-on-surface-variant">
          <p>{t('notes.share.none')}</p>
          <Link to="/notes" className="mt-2 inline-flex min-h-11 items-center font-semibold text-primary">
            {t('notes.share.writeOne')} <span aria-hidden="true">→</span>
          </Link>
        </div>
      ) : null}

      {choosable.length > 0 ? (
        <div className="mt-4">
          <p id={chooseLabelId} className="text-[12px] font-semibold text-on-surface-variant">
            {t('notes.share.choose')}
          </p>
          <ul role="group" aria-labelledby={chooseLabelId} className="mt-2 flex flex-col gap-2">
            {choosable.map((note) => (
              <li key={note.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border-default bg-surface px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={picked.has(note.id)}
                    onChange={() => toggle(note.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-[#5E3566]"
                  />
                  <span className="line-clamp-3 whitespace-pre-wrap text-[13.5px] leading-snug text-on-surface">
                    {note.body || t('notes.photoOnly')}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {unchecked > 0 ? (
        <p className="mt-3 text-[12px] text-on-surface-variant">{t('notes.share.needsChecking', { count: unchecked })}</p>
      ) : null}

      {choosable.length > 0 ? (
        <>
          <div className="mt-4 rounded-[14px] bg-surface-container-low px-3 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
            <p>{t('notes.share.consentWhat', { name: specialistName })}</p>
            <p className="mt-1.5">{t('notes.share.consentKeep')}</p>
          </div>
          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() => void share()}
            className="mt-4 min-h-11 w-full rounded-full bg-secondary px-5 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-45"
          >
            {busy ? t('notes.saving') : t('notes.share.cta', { count: picked.size })}
          </button>
        </>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-[12.5px] text-error">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-11 w-full rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-on-surface-variant"
      >
        {t('notes.done')}
      </button>
    </LogSheetFrame>
  );
}
