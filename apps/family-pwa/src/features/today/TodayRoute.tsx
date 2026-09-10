import { useCallback, useState } from 'react';
import type { FamilyMetricKey, FamilySupportActionKind } from '@anuva/shared';
import {
  fetchToday,
  postFamilyMessage,
  postRemindLater,
  postSupportAction,
} from '../../shared/lib/familyApi';
import { ACTION_LABELS } from '../data/labels';
import { useFamilyResource } from '../../shared/lib/useFamilyResource';
import { NotificationPermissionDialog } from '../notifications/NotificationPermissionDialog';
import { useNotificationPrompt } from '../notifications/useNotificationPrompt';
import { Card, ErrorCard, Eyebrow, PageIntro, PrimaryButton, SectionLabel, SkeletonCard } from '../shell/ui';
import { SupportActionSheet, Toast } from '../support/SupportActionSheet';

const TOAST_MS = 2800;

/**
 * One tint per metric, so the four tiles read as four different things at a glance rather than as a
 * grid of identical boxes. Deliberately quiet: these are bands and directions, not scores, and a
 * loud colour would imply a precision the data does not have.
 */
const METRIC_TINT: Record<FamilyMetricKey, string> = {
  sleep: 'bg-primary-fixed text-primary',
  mood: 'bg-secondary-fixed text-on-secondary-container',
  stress: 'bg-tertiary-fixed text-on-tertiary-container',
  energy: 'bg-surface-variant text-on-surface-variant',
};

export function TodayRoute() {
  const { data, error, loading, reload } = useFamilyResource(fetchToday);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Only asked once the screen has something on it: permission for a notification nobody has seen
  // the point of yet is the one most people decline.
  const notifications = useNotificationPrompt(Boolean(data));

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
  const progressPercent = progress
    ? Math.min(100, Math.round((progress.loggedDays / progress.totalDays) * 100))
    : 0;

  return (
    <div className="space-y-4">
      <PageIntro eyebrow={data.eyebrow} title={data.greeting} subline={data.dateLine} />

      {/* A stale card is better than a blank screen, so the last good payload stays rendered and
          the failure is reported above it. */}
      {error ? (
        <p className="rounded-[16px] bg-error-container/70 px-4 py-3 text-[12.5px] leading-relaxed text-on-error-container" role="alert">
          {error} Showing what we last had.
        </p>
      ) : null}

      {/* How she is. The one card that gets the gradient, because it is the reason the app exists
          and everything below it is a response to what it says. */}
      <Card
        tone="warm"
        className="relative overflow-hidden px-5 py-6 animate-[anuvaRise_460ms_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(201,126,146,0.22), rgba(201,126,146,0) 68%)' }}
          aria-hidden
        />
        <div className="relative">
          <SectionLabel>{status.label}</SectionLabel>
          <h2 className="font-display text-[25px] font-medium leading-[1.18] text-primary">
            {status.headline}
          </h2>
          <p className="mt-2.5 text-[14.5px] leading-[1.6] text-on-surface-variant">{status.body}</p>
        </div>
      </Card>

      {/* What they can do about it. Rose, raised, and always live — doing one thing today does not
          use the day up. */}
      <Card tone="warm" className="px-5 py-5">
        <Eyebrow>{support.label}</Eyebrow>
        <h2 className="font-display text-[20px] font-medium leading-snug text-on-surface">
          {support.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-on-surface-variant">{support.body}</p>

        {support.completedToday ? (
          <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[14px] bg-success/10 px-3 py-2 text-[12.5px] font-semibold text-success">
            <span aria-hidden>✓</span>
            <span>
              Done today: {support.completedKinds.map((kind) => ACTION_LABELS[kind] ?? kind).join(', ')}
            </span>
          </p>
        ) : null}

        <PrimaryButton onClick={() => setSheetOpen(true)} className="mt-4">
          {support.completedToday ? 'Do something else too' : support.cta}
        </PrimaryButton>
      </Card>

      <section>
        <SectionLabel>{data.metricsLabel}</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          {data.metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-[20px] border border-border-default bg-surface-raised px-4 py-4 shadow-soft"
            >
              <span
                className={`inline-block rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.1em] ${METRIC_TINT[metric.key]}`}
              >
                {metric.label}
              </span>
              <div className="mt-2.5 font-display text-[17px] font-medium leading-snug text-on-surface">
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </section>

      <Card className="px-5 py-5">
        <Eyebrow>{education.label}</Eyebrow>
        <h2 className="font-display text-[18px] font-medium leading-snug text-on-surface">
          {education.headline}
        </h2>
        <p className="mt-2 text-[14px] leading-[1.6] text-on-surface-variant">{education.body}</p>
      </Card>

      {/* Absent when she has logged nothing this week. A progress bar at zero would read as a
          judgement on her rather than an absence of data. */}
      {progress ? (
        <Card className="px-5 py-5">
          <Eyebrow>{progress.label}</Eyebrow>
          <h2 className="font-display text-[18px] font-medium leading-snug text-on-surface">
            {progress.headline}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-on-surface-variant">{progress.body}</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: 'linear-gradient(90deg, #5E3566, #C97E92)',
                }}
                aria-hidden
              />
            </div>
            <span className="font-display text-[13px] font-semibold tabular-nums text-primary">
              {progress.loggedDays}/{progress.totalDays}
            </span>
          </div>
        </Card>
      ) : null}

      {/* Absent when nothing is booked. */}
      {upcoming ? (
        <Card tone="quiet" className="px-5 py-5">
          <Eyebrow>{upcoming.label}</Eyebrow>
          <h2 className="font-display text-[18px] font-medium leading-snug text-on-surface">
            {upcoming.headline}
          </h2>
          <p className="mt-2 text-[14px] leading-[1.6] text-on-surface-variant">{upcoming.body}</p>
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
      <NotificationPermissionDialog
        open={notifications.open}
        registering={notifications.registering}
        onAccept={() => void notifications.accept()}
        onDismiss={notifications.dismiss}
      />
      <Toast message={toast ?? notifications.error} />
    </div>
  );
}
