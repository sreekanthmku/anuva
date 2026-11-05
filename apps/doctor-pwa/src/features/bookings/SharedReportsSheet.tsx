import { useCallback, useEffect, useRef, useState } from 'react';
import type { DoctorSharedReport } from '@anuva/shared';
import { useDialogA11y } from '../../lib/a11y/useDialogA11y';
import { FileIcon } from '../shell/icons';
import { fetchSharedReportPdf, fetchSharedReports } from './api';
import { formatLongDateTime } from './dateTime';

type Props = {
  consultationId: string;
  patientLabel: string;
  onClose: () => void;
};

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

const DAY = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const MONTH = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

function reportTitle(report: DoctorSharedReport): string {
  if (report.kind === 'assessment_14day') return '14-day assessment report';
  if (report.kind === 'weekly' && report.periodStart && report.periodEnd) {
    return `Weekly report, ${DAY.format(parseDay(report.periodStart))} – ${DAY.format(parseDay(report.periodEnd))}`;
  }
  if (report.kind === 'monthly' && report.periodStart) {
    return `Monthly report, ${MONTH.format(parseDay(report.periodStart))}`;
  }
  return 'Report';
}

/**
 * The reports she chose to share with this consultation, read-only. Each is the copy frozen when
 * she shared it, opened as a PDF. She can take one back at any time, after which it no longer
 * opens here — the server checks on every open, not just when this list loads.
 */
export function SharedReportsSheet({ consultationId, patientLabel, onClose }: Props) {
  const [reports, setReports] = useState<DoctorSharedReport[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const blobUrls = useRef<string[]>([]);
  // Mounted only while open.
  const dialogRef = useDialogA11y<HTMLDivElement>(true, onClose);

  const load = useCallback(async () => {
    try {
      setReports((await fetchSharedReports(consultationId)).reports);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load her reports.');
    }
  }, [consultationId]);

  useEffect(() => {
    void load();
    return () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    };
  }, [load]);

  const open = async (report: DoctorSharedReport) => {
    setBusyId(report.shareId);
    setError(null);
    try {
      const blob = await fetchSharedReportPdf({ consultationId, shareId: report.shareId });
      const url = URL.createObjectURL(blob);
      blobUrls.current.push(url);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This report could not be opened.');
      // Taken back since the list loaded: drop it from the list too.
      void load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shared-reports-title"
        aria-describedby="shared-reports-patient"
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-surface px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5 text-on-surface"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="shared-reports-title" className="font-display text-[22px] leading-tight">
              Her reports
            </h2>
            <p id="shared-reports-patient" className="mt-1 truncate text-[12px] text-on-surface-variant">
              {patientLabel}
            </p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-[13px] font-semibold text-primary">
            Close
          </button>
        </div>

        {reports === null && !error && (
          <p role="status" className="mt-6 text-[13px] text-on-surface-variant">
            Loading…
          </p>
        )}

        {error && (
          <p role="alert" className="mt-6 text-[13px] text-error">
            {error}
          </p>
        )}

        {reports !== null && reports.length === 0 && (
          <p className="mt-6 text-[13px] text-on-surface-variant">
            She hasn’t shared any reports for this consultation.
          </p>
        )}

        {reports !== null && reports.length > 0 && (
          <>
            <ul className="mt-4 flex flex-col gap-2.5">
              {reports.map((report) => (
                <li key={report.shareId}>
                  <button
                    type="button"
                    disabled={busyId !== null}
                    onClick={() => void open(report)}
                    className="flex min-h-[44px] w-full items-center gap-3 rounded-[16px] border border-border-default bg-surface-raised px-3 py-2.5 text-left disabled:opacity-60"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary-fixed text-primary">
                      <FileIcon />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold leading-snug">{reportTitle(report)}</span>
                      <span className="block text-[11.5px] text-on-surface-variant">
                        {busyId === report.shareId ? 'Opening…' : `Shared ${formatLongDateTime(report.sharedAt)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-[1.5] text-on-surface-variant">
              Each report is as it was when she shared it. She can take a report back at any time.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
