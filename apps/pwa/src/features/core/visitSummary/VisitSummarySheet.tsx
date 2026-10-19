import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  VISIT_SUMMARY_PATIENT_NOTE_MAX,
  type VisitSummary,
  type VisitSummarySection,
  type VisitSummarySectionKey,
} from '@anuva/shared';
import { ApiError } from '../../../shared/lib/api';
import { LogSheetFrame } from '../components/LogSheetFrame';
import { createSummaryDraft, fetchSharedSummary, revokeSummary, shareSummary } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

function SectionCard({
  section,
  included,
  onToggle,
}: {
  section: VisitSummarySection;
  included: boolean;
  /** Absent on a shared summary, which is read-only. */
  onToggle?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li
      className={`rounded-[16px] border px-3.5 py-3 transition-opacity ${
        included ? 'border-border-default bg-surface' : 'border-dashed border-border-default bg-surface-container-low opacity-60'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary">{section.title}</p>
        {onToggle ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-[12.5px] text-on-surface-variant">
            {included ? t('visitSummary.include') : t('visitSummary.leftOut')}
            <input
              type="checkbox"
              checked={included}
              onChange={onToggle}
              className="h-5 w-5 shrink-0 accent-[#5E3566]"
              aria-label={t('visitSummary.includeSection', { section: section.title })}
            />
          </label>
        ) : null}
      </div>
      {section.empty ? (
        <p className="mt-1 text-[13px] text-on-surface-variant">{section.empty}</p>
      ) : (
        <dl className="mt-1.5 flex flex-col gap-2">
          {section.rows.map((row, index) => (
            <div key={`${row.label}-${index}`}>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-on-surface-variant">{row.label}</dt>
                <dd className="text-right text-[13.5px] font-semibold text-on-surface">{row.value}</dd>
              </div>
              {row.detail ? <p className="mt-0.5 text-[12px] leading-snug text-on-surface-variant">{row.detail}</p> : null}
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

/**
 * Her summary for one doctor. Opens on the summary already shared, if there is one; otherwise it
 * builds a fresh draft from her data for her to read. Every section starts included and she can
 * leave any out; nothing reaches the doctor until she agrees to the notice and taps Share. The
 * wording is versioned (`VISIT_SUMMARY_SHARE_CONSENT_VERSION`) and recorded with the share.
 */
export function VisitSummarySheet({
  consultationId,
  specialistName,
  onClose,
  onShared,
}: {
  consultationId: string;
  specialistName: string;
  onClose: () => void;
  onShared?: (shared: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [excluded, setExcluded] = useState<Set<VisitSummarySectionKey>>(new Set());
  const [patientNote, setPatientNote] = useState('');
  const [pickedNotes, setPickedNotes] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildDraft = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const draft = await createSummaryDraft(consultationId);
      setSummary(draft);
      setExcluded(new Set());
      setPickedNotes(new Set());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('visitSummary.buildFailed'));
    } finally {
      setLoading(false);
    }
  }, [consultationId, t]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const shared = await fetchSharedSummary(consultationId);
        if (cancelled) return;
        if (shared) {
          setSummary(shared);
          setLoading(false);
        } else {
          await buildDraft();
        }
      } catch {
        if (!cancelled) {
          setError(t('visitSummary.buildFailed'));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [consultationId, buildDraft, t]);

  const toggleSection = (key: VisitSummarySectionKey) =>
    setExcluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleNote = (id: string) =>
    setPickedNotes((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const share = async () => {
    if (!summary) return;
    setBusy(true);
    setError(null);
    try {
      const shared = await shareSummary(consultationId, {
        draftId: summary.id,
        excludedSections: [...excluded],
        patientNote: patientNote.trim(),
        noteIds: [...pickedNotes],
      });
      setSummary(shared);
      onShared?.(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('visitSummary.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async () => {
    setBusy(true);
    setError(null);
    try {
      await revokeSummary(consultationId);
      onShared?.(false);
      await buildDraft();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('visitSummary.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const isShared = summary?.status === 'shared';
  // A shared summary shows only what the doctor received.
  const sections = summary
    ? isShared
      ? summary.sections.filter((section) => !summary.excludedSections.includes(section.key))
      : summary.sections
    : [];
  const choosableNotes = summary?.notes.filter((note) => !note.alreadyShared) ?? [];
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <LogSheetFrame onClose={onClose} closeLabel={t('visitSummary.close')} fontFamily={FONT_BODY} maxWidthClass="max-w-[420px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
        {t('visitSummary.eyebrow')}
      </p>
      <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">
        {isShared
          ? t('visitSummary.sharedTitle', { name: specialistName })
          : t('visitSummary.title', { name: specialistName })}
      </h2>

      {loading ? <p className="mt-4 text-[13.5px] text-on-surface-variant">{t('visitSummary.building')}</p> : null}

      {!loading && !summary && error ? (
        <div className="mt-4">
          <p className="text-[13px] text-error">{error}</p>
          <button
            type="button"
            onClick={() => void buildDraft()}
            className="mt-2 min-h-11 rounded-full border border-primary/30 px-4 text-[13px] font-semibold text-primary"
          >
            {t('visitSummary.retry')}
          </button>
        </div>
      ) : null}

      {!loading && summary ? (
        <>
          <p className="mt-1.5 text-[13px] text-on-surface-variant">
            {summary.window.label}
            {isShared && summary.sharedAt ? ` · ${t('visitSummary.sharedOn', { date: formatDate(summary.sharedAt) })}` : ''}
          </p>
          {!isShared ? (
            <p className="mt-2 text-[13px] leading-[1.5] text-on-surface">{t('visitSummary.intro')}</p>
          ) : null}

          <ul className="mt-4 flex flex-col gap-2.5">
            {sections.map((section) => (
              <SectionCard
                key={section.key}
                section={section}
                included={isShared || !excluded.has(section.key)}
                onToggle={isShared ? undefined : () => toggleSection(section.key)}
              />
            ))}
          </ul>

          {isShared ? (
            <>
              {summary.patientNote ? (
                <div className="mt-3 rounded-[16px] bg-primary-fixed px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary">
                    {t('visitSummary.discussLabel')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-on-surface">{summary.patientNote}</p>
                </div>
              ) : null}
              {summary.canRevoke ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void takeBack()}
                  className="mt-4 min-h-11 w-full rounded-full border border-primary/30 px-5 py-2.5 text-[13.5px] font-semibold text-primary disabled:opacity-45"
                >
                  {busy ? t('visitSummary.working') : t('visitSummary.takeBack')}
                </button>
              ) : (
                <p className="mt-3 text-[12px] text-on-surface-variant">{t('visitSummary.locked')}</p>
              )}
              {summary.canRevoke ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void buildDraft()}
                  className="mt-1 min-h-11 w-full rounded-full px-5 py-2.5 text-[13px] font-semibold text-on-surface-variant disabled:opacity-45"
                >
                  {t('visitSummary.makeFresh')}
                </button>
              ) : null}
            </>
          ) : (
            <>
              <label className="mt-4 block">
                <span className="text-[12.5px] font-semibold text-on-surface">{t('visitSummary.discussLabel')}</span>
                <textarea
                  value={patientNote}
                  onChange={(event) => setPatientNote(event.target.value.slice(0, VISIT_SUMMARY_PATIENT_NOTE_MAX))}
                  rows={3}
                  placeholder={t('visitSummary.discussPlaceholder')}
                  className="mt-1.5 w-full rounded-[14px] border border-border-default bg-surface px-3 py-2.5 text-[13.5px] text-on-surface placeholder:text-on-surface-variant/70"
                />
              </label>

              {choosableNotes.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[12.5px] font-semibold text-on-surface">{t('visitSummary.notesTitle')}</p>
                  <p className="text-[12px] text-on-surface-variant">{t('visitSummary.notesHint')}</p>
                  <ul className="mt-2 flex flex-col gap-2">
                    {choosableNotes.map((note) => (
                      <li key={note.noteId}>
                        <label className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-border-default bg-surface px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={pickedNotes.has(note.noteId)}
                            onChange={() => toggleNote(note.noteId)}
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

              <div className="mt-4 rounded-[14px] bg-surface-container-low px-3 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
                <p>{t('visitSummary.consentWhat', { name: specialistName })}</p>
                <p className="mt-1.5">{t('visitSummary.consentKeep')}</p>
              </div>
              <button
                type="button"
                disabled={busy || excluded.size === sections.length}
                onClick={() => void share()}
                className="mt-4 min-h-11 w-full rounded-full bg-secondary px-5 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-45"
              >
                {busy ? t('visitSummary.working') : t('visitSummary.share', { name: specialistName })}
              </button>
            </>
          )}

          {error ? <p className="mt-3 text-[12.5px] text-error">{error}</p> : null}
          {/* An out-of-date draft or notice is fixed by building a new one from today's data. */}
          {error && !isShared ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void buildDraft()}
              className="mt-1 min-h-11 text-[12.5px] font-semibold text-primary disabled:opacity-45"
            >
              {t('visitSummary.makeFresh')}
            </button>
          ) : null}
        </>
      ) : null}

      <button
        type="button"
        onClick={onClose}
        className="mt-2 min-h-11 w-full rounded-full px-5 py-2.5 text-[13.5px] font-semibold text-on-surface-variant"
      >
        {isShared ? t('visitSummary.done') : t('visitSummary.notNow')}
      </button>
    </LogSheetFrame>
  );
}
