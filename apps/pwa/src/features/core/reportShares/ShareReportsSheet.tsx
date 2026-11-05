import { useCallback, useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConsultationReportsResponse, ShareableReport } from '@anuva/shared';
import { announce } from '../../../lib/a11y/announce';
import { LogSheetFrame } from '../components/LogSheetFrame';
import { fetchConsultationReports, shareReports, unshareReport } from './api';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

function keyOf(report: ShareableReport): string {
  return `${report.kind}:${report.periodStart ?? ''}`;
}

function parseDay(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** "Your 14-day report", "Weekly report, 20 Oct – 26 Oct", "Monthly report, October 2026". */
function useReportLabel() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (report: ShareableReport) => {
      if (report.kind === 'weekly' && report.periodStart && report.periodEnd) {
        const day = (iso: string) =>
          parseDay(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
        return t('reports.kind.weekly', { range: `${day(report.periodStart)} – ${day(report.periodEnd)}` });
      }
      if (report.kind === 'monthly' && report.periodStart) {
        const month = parseDay(report.periodStart).toLocaleDateString(i18n.language, {
          month: 'long',
          year: 'numeric',
        });
        return t('reports.kind.monthly', { month });
      }
      return t(`reports.kind.${report.kind}`);
    },
    [i18n.language, t],
  );
}

/**
 * Choosing which reports one doctor sees. Nothing is ticked for her: every report shared is one she
 * picked, under a notice that says what the doctor gets and that she can take it back at any time.
 * The wording is versioned (`REPORT_SHARE_CONSENT_VERSION`) and recorded on every share.
 *
 * Once the consultation is over she can no longer add reports, but can still take any back.
 */
export function ShareReportsSheet({
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
  const { t, i18n } = useTranslation();
  const label = useReportLabel();
  const [data, setData] = useState<ConsultationReportsResponse | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sharedLabelId = useId();
  const chooseLabelId = useId();

  const load = useCallback(async () => {
    try {
      setData(await fetchConsultationReports(consultationId));
      setError(null);
    } catch {
      setError(t('reports.loadFailed'));
    }
  }, [consultationId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = (key: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const share = async () => {
    if (!data) return;
    setBusy(true);
    setError(null);
    try {
      const chosen = data.available.filter((report) => picked.has(keyOf(report)));
      const result = await shareReports(consultationId, chosen);
      setData(result);
      setPicked(new Set());
      onChanged?.(result.shared.length);
      announce(t('a11y.care.reportsShared', { count: chosen.length, name: specialistName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const takeBack = async (shareId: string) => {
    setBusy(true);
    setError(null);
    try {
      await unshareReport(consultationId, shareId);
      // Reloaded rather than patched: the report she took back is offered again while she can share.
      const next = await fetchConsultationReports(consultationId);
      setData(next);
      onChanged?.(next.shared.length);
      announce(t('a11y.care.reportTakenBack'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('reports.shareFailed'));
    } finally {
      setBusy(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <LogSheetFrame onClose={onClose} closeLabel={t('reports.close')} fontFamily={FONT_BODY} maxWidthClass="max-w-[400px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">{t('reports.eyebrow')}</p>
      <h2 className="font-display mt-1 text-[22px] leading-tight text-on-surface">
        {t('reports.share.title', { name: specialistName })}
      </h2>

      {data === null && !error ? (
        <p role="status" className="mt-4 text-[13.5px] text-on-surface-variant">
          {t('reports.loading')}
        </p>
      ) : null}

      {data && data.shared.length > 0 ? (
        <div className="mt-4">
          <p id={sharedLabelId} className="text-[12px] font-semibold text-on-surface-variant">
            {t('reports.share.alreadyShared')}
          </p>
          <ul aria-labelledby={sharedLabelId} className="mt-2 flex flex-col gap-2">
            {data.shared.map((report) => (
              <li
                key={report.shareId}
                className="flex items-center justify-between gap-3 rounded-[14px] bg-primary-fixed px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p id={`shared-report-${report.shareId}`} className="text-[13.5px] font-semibold leading-snug text-on-surface">
                    {label(report)}
                  </p>
                  <p className="text-[11.5px] text-on-surface-variant">
                    {t('reports.share.sharedOn', { date: formatDate(report.sharedAt) })}
                  </p>
                </div>
                {report.canRevoke ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void takeBack(report.shareId)}
                    aria-describedby={`shared-report-${report.shareId}`}
                    className="min-h-11 shrink-0 px-1 text-[12.5px] font-semibold text-primary disabled:opacity-45"
                  >
                    {t('reports.share.takeBack')}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data && !data.canShare ? (
        <p className="mt-4 text-[13px] leading-[1.5] text-on-surface-variant">{t('reports.share.closed')}</p>
      ) : null}

      {data && data.canShare && data.available.length === 0 && data.shared.length === 0 ? (
        <p className="mt-4 text-[13.5px] leading-[1.5] text-on-surface-variant">{t('reports.share.none')}</p>
      ) : null}

      {data && data.canShare && data.available.length > 0 ? (
        <>
          <div className="mt-4">
            <p id={chooseLabelId} className="text-[12px] font-semibold text-on-surface-variant">
              {t('reports.share.choose')}
            </p>
            <ul role="group" aria-labelledby={chooseLabelId} className="mt-2 flex flex-col gap-2">
              {data.available.map((report) => {
                const key = keyOf(report);
                return (
                  <li key={key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[14px] border border-border-default bg-surface px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={picked.has(key)}
                        onChange={() => toggle(key)}
                        className="h-5 w-5 shrink-0 accent-[#5E3566]"
                      />
                      <span className="text-[13.5px] leading-snug text-on-surface">{label(report)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 rounded-[14px] bg-surface-container-low px-3 py-3 text-[12.5px] leading-[1.5] text-on-surface-variant">
            <p>{t('reports.share.consentWhat', { name: specialistName })}</p>
            <p className="mt-1.5">{t('reports.share.consentKeep', { name: specialistName })}</p>
          </div>
          <button
            type="button"
            disabled={busy || picked.size === 0}
            onClick={() => void share()}
            className="mt-4 min-h-11 w-full rounded-full bg-secondary px-5 py-3 text-[14px] font-semibold text-on-secondary disabled:opacity-45"
          >
            {busy ? t('reports.saving') : t('reports.share.cta', { count: picked.size })}
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
        {t('reports.done')}
      </button>
    </LogSheetFrame>
  );
}
