import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { WeeklyReportResponse } from '@anuva/shared';
import i18n from '../../../i18n';
import { announce } from '../../../lib/a11y/announce';
import { Eyebrow } from '../../../shared/components/Eyebrow';
import { apiUrl } from '../../../shared/lib/api';

const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * A completed week or month: download it as a PDF, or — with too few days logged for a report —
 * a reminder to keep tracking. Not shown on daily or on the period still in progress
 * (`report.pdf` is null there). Separate from the 14-day assessment report on Profile.
 */
export function ReportPdfCard({ report }: { report: WeeklyReportResponse }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Blob URLs stay alive until the page unmounts, so the opened tab keeps working.
  const blobUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      blobUrls.current.forEach((url) => URL.revokeObjectURL(url));
      blobUrls.current = [];
    },
    [],
  );

  const pdf = report.pdf;
  const { period, offset } = report;

  /**
   * Fetched as a blob and opened from memory, like the 14-day report: a plain link would not carry
   * the session on a cross-origin API host.
   */
  const download = useCallback(async () => {
    setDownloading(true);
    setError(null);
    // The button's own label changes, but a changed label is not read out by itself.
    announce(i18n.t('report.pdf.downloading'));
    try {
      const response = await fetch(apiUrl(`/api/report/pdf?period=${period}&offset=${offset}`), {
        credentials: 'include',
        headers: { 'Accept-Language': i18n.language },
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(typeof body?.error === 'string' ? body.error : i18n.t('report.pdf.failed'));
      }
      const url = URL.createObjectURL(await response.blob());
      blobUrls.current.push(url);
      if (!window.open(url, '_blank', 'noopener')) {
        // Pop-up blocked: hand the browser a download rather than lose the PDF.
        const link = document.createElement('a');
        link.href = url;
        link.download = `anuva-${period}-report-${report.periodStart}.pdf`;
        link.click();
      }
      announce(i18n.t('a11y.summary.pdfReady'));
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('report.pdf.failed'));
    } finally {
      setDownloading(false);
    }
  }, [period, offset, report.periodStart]);

  if (!pdf || period === 'daily') return null;

  if (pdf.tier === 'insufficient') {
    return (
      <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
        <Eyebrow tone="muted">{t(`report.pdf.insufficientEyebrow.${period}`)}</Eyebrow>
        <p className="text-[14px] leading-[1.45] text-on-surface" style={{ fontFamily: MULISH }}>
          {t(`report.pdf.insufficientBody.${period}`, { logged: report.daysLogged, need: pdf.minDays })}
        </p>
        <button
          type="button"
          onClick={() => navigate('/track')}
          className="mt-3 min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary"
          style={{ fontFamily: MULISH }}
        >
          {t('report.logHowYouFeel')}
        </button>
      </article>
    );
  }

  return (
    <article className="rounded-[20px] border border-border-default bg-surface-raised p-4">
      <Eyebrow tone="gold">{t(`report.pdf.eyebrow.${period}`)}</Eyebrow>
      <p className="text-[14px] leading-[1.45] text-on-surface" style={{ fontFamily: MULISH }}>
        {t(`report.pdf.body.${period}`)}
      </p>
      {pdf.tier === 'limited' && (
        <p className="mt-2 text-[12px] leading-[1.45] text-on-surface-variant" style={{ fontFamily: MULISH }}>
          {t(`report.pdf.limited.${period}`, {
            logged: report.daysLogged,
            total: report.periodLength,
            full: pdf.fullDays,
          })}
        </p>
      )}
      <button
        type="button"
        onClick={() => void download()}
        disabled={downloading}
        className="mt-3 min-h-[44px] rounded-full bg-secondary px-5 text-[13px] font-medium text-on-secondary disabled:opacity-60"
        style={{ fontFamily: MULISH }}
      >
        {downloading ? t('report.pdf.downloading') : t('report.pdf.download')}
      </button>
      {error && (
        <p className="mt-2 text-[12px] text-error" style={{ fontFamily: MULISH }} role="alert">
          {error}
        </p>
      )}
    </article>
  );
}
