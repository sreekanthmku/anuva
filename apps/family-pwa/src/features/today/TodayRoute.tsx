import { useCallback, useState } from 'react';
import { supportSheet, todayContent } from '../data/dummy';
import { Card, Eyebrow, PageIntro, SectionLabel } from '../shell/ui';
import { SupportActionSheet, Toast } from '../support/SupportActionSheet';

const TOAST_MS = 2400;

export function TodayRoute() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow={todayContent.eyebrow}
        title={todayContent.greeting}
        subline={todayContent.dateLine}
      />

      <Card className="overflow-hidden bg-primary-container/60 px-5 py-5">
        <SectionLabel>{todayContent.status.label}</SectionLabel>
        <h2 className="font-display text-[24px] leading-[1.15] text-on-surface">
          {todayContent.status.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {todayContent.status.body}
        </p>
      </Card>

      <Card className="px-5 py-5">
        <Eyebrow>{todayContent.support.label}</Eyebrow>
        <h2 className="font-display text-[20px] leading-tight text-on-surface">
          {todayContent.support.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {todayContent.support.body}
        </p>
        <button
          type="button"
          disabled={completed}
          onClick={() => setSheetOpen(true)}
          className={`mt-4 flex min-h-[48px] w-full items-center justify-center rounded-full px-5 text-[14.5px] font-semibold transition-colors ${
            completed
              ? 'bg-success/15 text-success'
              : 'bg-secondary text-on-secondary shadow-[0_8px_20px_rgba(201,126,146,0.28)]'
          }`}
        >
          {completed ? todayContent.support.completedCta : todayContent.support.cta}
        </button>
      </Card>

      <section>
        <SectionLabel>{todayContent.metricsLabel}</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {todayContent.metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-[18px] border border-border-default bg-surface-raised px-3.5 py-3.5 shadow-[0_8px_20px_rgba(94,53,102,0.04)]"
            >
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-outline">
                {metric.label}
              </div>
              <div className="mt-1.5 font-display text-[17px] leading-snug text-on-surface">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="px-5 py-5">
        <SectionLabel>{todayContent.education.label}</SectionLabel>
        <h2 className="font-display text-[18px] leading-snug text-on-surface">
          {todayContent.education.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {todayContent.education.body}
        </p>
      </Card>

      <Card className="px-5 py-5">
        <SectionLabel>{todayContent.progress.label}</SectionLabel>
        <h2 className="font-display text-[18px] leading-snug text-on-surface">
          {todayContent.progress.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {todayContent.progress.body}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${(11 / 14) * 100}%` }}
            aria-hidden
          />
        </div>
      </Card>

      <Card className="px-5 py-5">
        <SectionLabel>{todayContent.upcoming.label}</SectionLabel>
        <h2 className="font-display text-[18px] leading-snug text-on-surface">
          {todayContent.upcoming.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">
          {todayContent.upcoming.body}
        </p>
      </Card>

      <SupportActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDone={() => {
          setSheetOpen(false);
          setCompleted(true);
          showToast(supportSheet.toastDone);
        }}
        onRemindLater={() => {
          setSheetOpen(false);
          showToast(supportSheet.toastRemind);
        }}
      />
      <Toast message={toast} />
    </div>
  );
}
