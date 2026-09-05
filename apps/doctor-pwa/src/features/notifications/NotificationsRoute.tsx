import { useEffect } from 'react';
import type { DoctorNotification } from '@anuva/shared';
import { useNavigate } from 'react-router-dom';
import { PageHeading } from '../shell/AppShell';
import { BellIcon, CalendarIcon, ChatIcon, ChevronRightIcon } from '../shell/icons';
import { Card, EmptyState, ErrorNote, SkeletonCard } from '../shell/ui';
import { useNotifications } from './store';

function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / (60 * 24))}d ago`;

  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(iso));
}

function TypeIcon({ type }: { type: DoctorNotification['type'] }) {
  if (type === 'question_asked') {
    return <ChatIcon size={19} />;
  }

  if (type === 'consultation_cancelled') {
    return <CalendarIcon size={19} />;
  }

  return <CalendarIcon size={19} />;
}

function toneFor(type: DoctorNotification['type']): string {
  if (type === 'consultation_cancelled') return 'bg-error/12 text-error';
  if (type === 'question_asked') return 'bg-tertiary/15 text-tertiary';
  return 'bg-primary-fixed text-primary';
}

export function NotificationsRoute() {
  const navigate = useNavigate();
  const { notifications, loading, error, markAllRead, refresh } = useNotifications();

  // Opening the tab is the read. The badge clears immediately; the write is fire-and-forget.
  useEffect(() => {
    void markAllRead();
  }, [markAllRead]);

  return (
    <>
      <PageHeading
        eyebrow="Activity"
        title="Your"
        accent="notifications"
        description="Bookings, cancellations, and new questions in the shared queue, newest first."
      />

      <div className="flex flex-col gap-2.5">
        {loading && notifications.length === 0 ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : null}

        {error ? (
          <ErrorNote>
            {error}{' '}
            <button type="button" onClick={() => void refresh()} className="font-semibold underline">
              Retry
            </button>
          </ErrorNote>
        ) : null}

        {!loading && notifications.length === 0 && !error ? (
          <EmptyState
            title="Nothing yet"
            body="New bookings, cancellations, and questions will show up here, and on your phone once notifications are switched on in Profile."
          />
        ) : null}

        {notifications.map((notification) => {
          const unread = notification.readAt === null;
          const target = notification.url;

          return (
            <Card key={notification.id} className={unread ? 'border-primary/30' : ''}>
              <button
                type="button"
                disabled={!target}
                onClick={() => target && navigate(target)}
                className="flex w-full items-start gap-3 p-4 text-left disabled:cursor-default"
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toneFor(notification.type)}`}
                >
                  <TypeIcon type={notification.type} />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-[14px] text-on-surface">
                      {notification.title}
                    </span>
                    {unread ? (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-secondary" aria-label="Unread" />
                    ) : null}
                  </span>
                  <span className="mt-1 block text-[13px] leading-[1.5] text-on-surface-variant">
                    {notification.body}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-outline">
                    {relativeTime(notification.createdAt)}
                  </span>
                </span>

                {target ? (
                  <span className="mt-1 shrink-0 text-outline">
                    <ChevronRightIcon size={17} />
                  </span>
                ) : null}
              </button>
            </Card>
          );
        })}
      </div>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-[11.5px] text-outline">
        <BellIcon size={14} />
        Alerts are kept for your account only.
      </p>
    </>
  );
}
