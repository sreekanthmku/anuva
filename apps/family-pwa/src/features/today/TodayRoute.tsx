import { useCallback, useState } from 'react';
import type { FamilySupportActionKind } from '@anuva/shared';
import {
  fetchToday,
  postFamilyMessage,
  postRemindLater,
  postSupportAction,
} from '../../shared/lib/familyApi';
import { ACTION_LABELS } from '../data/labels';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { Card, ErrorCard, Eyebrow, PageIntro, SectionLabel, SkeletonCard } from '../shell/ui';
import { SupportActionSheet, Toast } from '../support/SupportActionSheet';

const TOAST_MS = 2800;

export function TodayRoute() {
  const { data, error, loading, reload } = useFamilyResource(fetchToday);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const takeAction = useCallback(
    async (kind: FamilySupportActionKind) => {
      setSheetOpen(false);
      try {
        const result = await postSupportAction(kind);
        showToast(result.toast);
        await reload();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not record that.');
      }
    },
    [showToast, reload],
  );

  const sendMessage = useCallback(
    async (text: string) => {
      setSheetOpen(false);
      try {
        const result = await postFamilyMessage(text);
        showToast(result.toast);
        await reload();
      } catch (e) {
        showToast(e instanceof Error ? e.message : 'Could not send that note.');
      }
    },
    [showToast, reload],
  );

  const remindLater = useCallback(async () => {
    setSheetOpen(false);
    try {
      const result = await postRemindLater();
      showToast(result.toast);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not save that reminder.');
    }
  }, [showToast]);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    );
  }

  if (!data) {
    return <ErrorCard message={error ?? 'Could not load her week.'} onRetry={() => void reload()} />;
  }

  const { status, support, education, progress, upcoming } = data;

  return (
    <div className="space-y-4">
      <PageIntro eyebrow={data.eyebrow} title={data.greeting} subline={data.dateLine} />

      {/* A stale card is better than a blank screen, so the last good payload stays rendered and
          the failure is reported above it. */}
      {error ? (
        <p className="text-[12px] leading-relaxed text-error" role="alert">
          {error} Showing what we last had.
        </p>
      ) : null}

      <Card className="overflow-hidden bg-primary-container/60 px-5 py-5">
        <SectionLabel>{status.label}</SectionLabel>
        <h2 className="font-display text-[24px] leading-[1.15] text-on-surface">{status.headline}</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{status.body}</p>
      </Card>

      <Card className="px-5 py-5">
        <Eyebrow>{support.label}</Eyebrow>
        <h2 className="font-display text-[20px] leading-tight text-on-surface">{support.headline}</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{support.body}</p>
        {/* Doing one thing does not use up the day: she may be worth a message *and* flowers. So
            what is done is confirmed above the button, and the button stays live. */}
        {support.completedToday ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] font-semibold text-success">
            <span aria-hidden>✓</span>
            <span>
              Done today:{' '}
              {support.completedKinds
                .map((kind) => ACTION_LABELS[kind] ?? kind)
                .join(', ')}
            </span>
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-full bg-secondary px-5 text-[14.5px] font-semibold text-on-secondary shadow-[0_8px_20px_rgba(201,126,146,0.28)]"
        >
          {support.completedToday ? 'Do something else too' : support.cta}
        </button>
      </Card>

      <section>
        <SectionLabel>{data.metricsLabel}</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5">
          {data.metrics.map((metric) => (
            <div
              key={metric.key}
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
        <SectionLabel>{education.label}</SectionLabel>
        <h2 className="font-display text-[18px] leading-snug text-on-surface">{education.headline}</h2>
        <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{education.body}</p>
      </Card>

      {/* Absent when she has logged nothing this week. A progress bar at zero would read as a
          judgement on her rather than an absence of data. */}
      {progress ? (
        <Card className="px-5 py-5">
          <SectionLabel>{progress.label}</SectionLabel>
          <h2 className="font-display text-[18px] leading-snug text-on-surface">{progress.headline}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{progress.body}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-container">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((progress.loggedDays / progress.totalDays) * 100)}%` }}
              aria-hidden
            />
          </div>
        </Card>
      ) : null}

      {/* Absent when nothing is booked. */}
      {upcoming ? (
        <Card className="px-5 py-5">
          <SectionLabel>{upcoming.label}</SectionLabel>
          <h2 className="font-display text-[18px] leading-snug text-on-surface">{upcoming.headline}</h2>
          <p className="mt-2 text-[14px] leading-[1.55] text-on-surface-variant">{upcoming.body}</p>
        </Card>
      ) : null}

      <SupportActionSheet
        open={sheetOpen}
        doneKinds={support.completedKinds}
        onClose={() => setSheetOpen(false)}
        onDone={(kind) => void takeAction(kind)}
        onSendMessage={sendMessage}
        onRemindLater={() => void remindLater()}
      />
      <Toast message={toast} />
    </div>
  );
}
