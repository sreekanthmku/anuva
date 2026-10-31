import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

type Report14ReadySheetProps = {
  open: boolean;
  onOpenReport: () => void;
  onClose: () => void;
};

/** Day 15: her 14-day report is ready. Shown until she opens it; see `report14Guide.ts`. */
export function Report14ReadySheet({ open, onOpenReport, onClose }: Report14ReadySheetProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label={t('report14Ready.later')}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report14-ready-title"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-outline/40" />
        <p
          className="mb-2 text-[10px] uppercase tracking-[0.18em] text-tertiary"
          style={{ fontFamily: '"Mulish", sans-serif' }}
        >
          {t('report14Ready.eyebrow')}
        </p>
        <h2
          id="report14-ready-title"
          className="font-display mb-2.5 text-[26px] leading-[1.15] tracking-[-0.02em] text-on-surface"
        >
          {t('report14Ready.title')}
        </h2>
        <p
          className="mb-6 text-[14px] leading-[1.6] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {t('report14Ready.body')}
        </p>

        <button
          type="button"
          onClick={onOpenReport}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-semibold text-on-secondary"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {t('report14Ready.open')}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-transparent text-[13px] text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          {t('report14Ready.later')}
        </button>
      </div>
    </>
  );
}
