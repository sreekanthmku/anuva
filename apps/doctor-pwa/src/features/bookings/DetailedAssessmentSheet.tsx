import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MULTISELECT_SEPARATOR,
  PRACTITIONER_LABELS,
  detailedAssessmentSections,
  type DetailedPractitioner,
  type DetailedQuestion,
  type DoctorDetailedAssessmentResponse,
} from '@anuva/shared';
import { fetchDetailedAssessment } from './api';

type Props = {
  consultationId: string;
  patientLabel: string;
  onClose: () => void;
};

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function lensSummary(lenses: DetailedPractitioner[]): string {
  if (lenses.includes('all')) return 'Full assessment';
  if (lenses.length === 0) return 'No sections assigned';
  return lenses.map((lens) => PRACTITIONER_LABELS[lens]).join(' · ');
}

/** Renders one stored answer in the shape it was captured, not as a raw string. */
function AnswerValue({ question, value }: { question: DetailedQuestion; value: string }) {
  if (question.inputType === 'signature') {
    return (
      <img
        src={value}
        alt="Signature"
        className="mt-1 max-h-24 rounded-[12px] border border-border-default bg-white"
      />
    );
  }

  if (question.inputType === 'date') {
    return <p className="mt-0.5 text-[14px] font-semibold">{formatIsoDate(value)}</p>;
  }

  if (question.inputType === 'multiselect') {
    const picked = value
      .split(MULTISELECT_SEPARATOR.trim())
      .map((entry) => entry.trim())
      .filter(Boolean);
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {picked.map((entry) => (
          <span
            key={entry}
            className="rounded-full border border-border-default px-2.5 py-1 text-[12px] font-semibold"
          >
            {entry}
          </span>
        ))}
      </div>
    );
  }

  if (question.inputType === 'textlist' || question.inputType === 'dynlist') {
    let rows: unknown = [];
    try {
      rows = JSON.parse(value);
    } catch {
      return <p className="mt-0.5 whitespace-pre-wrap text-[14px] font-semibold">{value}</p>;
    }
    if (!Array.isArray(rows)) return null;

    const lines = rows
      .map((row) => (Array.isArray(row) ? row.filter(Boolean).join(' · ') : String(row)))
      .filter((line) => line.trim() !== '');

    if (lines.length === 0) return null;

    return (
      <ul className="mt-1 list-inside list-disc text-[14px] font-semibold">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    );
  }

  return <p className="mt-0.5 whitespace-pre-wrap text-[14px] font-semibold">{value}</p>;
}

/**
 * The reviewer's read of a user's detailed assessment. Sections arrive already narrowed to the
 * lenses this specialist holds — this component renders what it was given and never filters, so
 * what appears here is exactly what the server decided may be seen.
 */
export function DetailedAssessmentSheet({ consultationId, patientLabel, onClose }: Props) {
  const [data, setData] = useState<DoctorDetailedAssessmentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await fetchDetailedAssessment(consultationId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the assessment.');
    } finally {
      setLoading(false);
    }
  }, [consultationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleSections = useMemo(() => {
    if (!data) return [];
    const allowed = new Set(data.sectionKeys);
    return detailedAssessmentSections.filter((section) => allowed.has(section.key));
  }, [data]);

  const answeredCount = data ? Object.keys(data.answers).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-on-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight">Health assessment</h2>
            <p className="mt-1 truncate text-[12px] text-on-surface-variant">{patientLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[13px] font-semibold text-primary"
          >
            Close
          </button>
        </div>

        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] text-outline">
            <span className="rounded-full border border-border-default px-2.5 py-1">
              {lensSummary(data.lenses)}
            </span>
            <span className="rounded-full border border-border-default px-2.5 py-1">
              {data.status === 'completed'
                ? `Submitted ${data.completedAt ? formatIsoDate(data.completedAt.slice(0, 10)) : ''}`
                : data.status === 'in_progress'
                  ? 'In progress'
                  : 'Not started'}
            </span>
          </div>
        )}

        {loading && <p className="mt-6 text-[13px] text-on-surface-variant">Loading…</p>}

        {error && <p className="mt-6 text-[13px] text-error">{error}</p>}

        {!loading && !error && visibleSections.length === 0 && (
          <p className="mt-6 text-[13px] text-on-surface-variant">
            No sections are assigned to your specialty. Ask an administrator to assign your review
            lens.
          </p>
        )}

        {!loading && !error && visibleSections.length > 0 && answeredCount === 0 && (
          <p className="mt-6 text-[13px] text-on-surface-variant">
            She has not answered any of your sections yet.
          </p>
        )}

        {!loading &&
          !error &&
          data &&
          visibleSections.map((section) => {
            const answered = section.questions.filter(
              (question) => (data.answers[question.key] ?? '') !== '',
            );
            if (answered.length === 0) return null;

            return (
              <section key={section.key} className="mt-6">
                <h3 className="font-display text-[17px] leading-tight">{section.title}</h3>
                <p className="mt-0.5 text-[11px] uppercase tracking-[0.12em] text-outline">
                  {PRACTITIONER_LABELS[section.primary]}
                  {section.secondary ? ` · ${PRACTITIONER_LABELS[section.secondary]}` : ''}
                </p>

                <dl className="mt-3 flex flex-col gap-2.5">
                  {answered.map((question) => (
                    <div
                      key={question.key}
                      className="rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5"
                    >
                      <dt className="text-[12px] leading-snug text-on-surface-variant">
                        {question.prompt}
                      </dt>
                      <dd>
                        <AnswerValue question={question} value={data.answers[question.key] ?? ''} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
      </div>
    </div>
  );
}
