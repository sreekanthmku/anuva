import { useEffect, useState } from 'react';
import type { DoctorVisitSummary } from '@anuva/shared';
import { fetchVisitSummary } from './api';
import { formatLongDateTime } from './dateTime';

type Props = {
  consultationId: string;
  patientLabel: string;
  onClose: () => void;
};

/**
 * The summary of her logs she chose to share before this consultation, read-only. It is the copy
 * frozen when she shared it, and any section she left out never reaches this screen — the API drops
 * it. Figures come from what she logged in the app, not from a clinical measurement.
 */
export function VisitSummarySheet({ consultationId, patientLabel, onClose }: Props) {
  const [summary, setSummary] = useState<DoctorVisitSummary | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVisitSummary(consultationId)
      .then((response) => {
        if (!cancelled) setSummary(response.summary);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load her summary.');
      });
    return () => {
      cancelled = true;
    };
  }, [consultationId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-on-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] leading-tight">Pre-visit summary</h2>
            <p className="mt-1 truncate text-[12px] text-on-surface-variant">{patientLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-[13px] font-semibold text-primary">
            Close
          </button>
        </div>

        {summary === undefined && !error && <p className="mt-6 text-[13px] text-on-surface-variant">Loading…</p>}

        {error && <p className="mt-6 text-[13px] text-error">{error}</p>}

        {summary === null && (
          <p className="mt-6 text-[13px] text-on-surface-variant">
            She hasn’t shared a summary for this consultation.
          </p>
        )}

        {summary ? (
          <>
            <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-outline">
              {summary.window.label} · Shared {formatLongDateTime(summary.sharedAt)}
            </p>
            <p className="mt-1.5 text-[12px] text-on-surface-variant">
              Self-reported in the Anuva Wellness app. She chose which sections to include.
            </p>

            {summary.patientNote ? (
              <div className="mt-3 rounded-[16px] bg-primary-fixed px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary">
                  What she would like to discuss
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-[1.5]">{summary.patientNote}</p>
              </div>
            ) : null}

            <ul className="mt-3 flex flex-col gap-2.5">
              {summary.sections.map((section) => (
                <li
                  key={section.key}
                  className="rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-tertiary">{section.title}</p>
                  {section.empty ? (
                    <p className="mt-1 text-[13px] text-on-surface-variant">{section.empty}</p>
                  ) : (
                    <dl className="mt-1.5 flex flex-col gap-2">
                      {section.rows.map((row, index) => (
                        <div key={`${row.label}-${index}`}>
                          <div className="flex items-baseline justify-between gap-3">
                            <dt className="text-[13px] text-on-surface-variant">{row.label}</dt>
                            <dd className="text-right text-[13.5px] font-semibold">{row.value}</dd>
                          </div>
                          {row.detail ? (
                            <p className="mt-0.5 text-[12px] leading-snug text-on-surface-variant">{row.detail}</p>
                          ) : null}
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
