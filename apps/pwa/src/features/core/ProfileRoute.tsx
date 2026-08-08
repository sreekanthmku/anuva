import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  enablePushNotifications,
  needsPushRegistrationRetry,
  syncFcmTokenIfGranted,
} from '../../lib/firebase';
import { DPDP_ACT_URL } from '../../shared/lib/dpdp';
import { Eyebrow } from '../../shared/components/Eyebrow';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';

const menuRows: { label: string; hint: string; id?: string; to?: string }[] = [
  {
    id: 'bookings',
    label: 'Your consultations',
    hint: 'Upcoming, past & recordings',
    to: '/my-bookings',
  },
  { id: 'notifications', label: 'Notifications', hint: 'Reminders & weekly summary' },
  { label: 'Privacy & data', hint: 'DPDP · export or delete' },
  { label: 'Subscription', hint: 'Plan & billing' },
  { id: 'help', label: 'Help & support', hint: 'Ask us anything · we reply in the app', to: '/help' },
];

function notificationStatusHint(): string {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'Not supported in this browser';
  }

  if (Notification.permission === 'granted' && needsPushRegistrationRetry()) {
    return 'Enabled — tap to finish setup';
  }

  if (Notification.permission === 'granted') {
    return 'Enabled on this device';
  }

  if (Notification.permission === 'denied') {
    return 'Blocked — enable in browser settings';
  }

  return 'Tap to enable reminders';
}

export default function ProfileRoute() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [notificationNote, setNotificationNote] = useState<string | null>(null);
  const displayName = user?.name?.trim() || 'Anuva Wellness Member';
  const initial = displayName.charAt(0).toUpperCase() || 'A';
  const memberSince = user
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : null;

  async function handleNotificationsRow() {
    setNotificationNote(null);

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationNote('This browser does not support notifications.');
      return;
    }

    if (Notification.permission === 'denied') {
      setNotificationNote(
        'Notifications are blocked. Enable them in your browser site settings, then return here.'
      );
      return;
    }

    if (Notification.permission === 'granted') {
      const sync = await syncFcmTokenIfGranted();
      if (sync?.ok) {
        setNotificationNote('Device registered for notifications.');
        return;
      }
      setNotificationNote(sync?.message ?? 'Could not register this device.');
      return;
    }

    const { permission, sync } = await enablePushNotifications();
    if (permission !== 'granted') {
      setNotificationNote('Notification permission was not granted.');
      return;
    }

    if (sync && !sync.ok) {
      setNotificationNote(sync.message);
      return;
    }

    setNotificationNote('Notifications enabled.');
  }

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 text-on-surface">
      <header className="sticky top-0 z-30 bg-surface px-3 pb-4 pt-[max(0.875rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="bg-transparent p-0 text-[13px] text-on-surface-variant"
            style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
          >
            ← Home
          </button>
          <img src="/anu.png" alt="Anuva" className="h-5 w-5 object-contain opacity-80" />
        </div>
      </header>

      <section className="px-3 pb-6 pt-2">
        <Eyebrow>Your account</Eyebrow>

        <div className="mb-6 flex items-center gap-4">
          <span
            className="inline-flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border text-[22px] text-primary"
            style={{
              background: '#EFE4D8',
              borderColor: 'rgba(180, 159, 176, 0.35)',
              fontFamily: '"Fraunces", sans-serif',
              fontWeight: 500,
            }}
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[24px] leading-tight text-on-surface">
              {displayName}
            </h1>
            <p
              className="mt-0.5 truncate text-[13px] text-on-surface-variant"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {user?.phone || 'Phone not available'}
            </p>
            <p
              className="mt-1 text-[11px] text-outline"
              style={{ fontFamily: '"Mulish", sans-serif' }}
            >
              {memberSince ? `Member since ${memberSince}` : 'Member'}
            </p>
          </div>
        </div>

        <article className="overflow-hidden rounded-[20px] border border-border-default bg-surface-raised">
          <ul className="divide-y divide-border-default">
            {menuRows.map((row) => (
              <li key={row.label}>
                <button
                  type="button"
                  onClick={
                    row.to
                      ? () => navigate(row.to as string)
                      : row.id === 'notifications'
                        ? () => void handleNotificationsRow()
                        : undefined
                  }
                  className="flex w-full flex-col items-start gap-0.5 px-5 py-4 text-left transition-colors hover:bg-primary-container/60"
                >
                  <span
                    className="text-[15px] text-on-surface"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {row.label}
                  </span>
                  <span
                    className="text-[12px] text-on-surface-variant"
                    style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                  >
                    {row.id === 'notifications' ? (
                      notificationStatusHint()
                    ) : row.label === 'Privacy & data' ? (
                      <>
                        <a
                          href={DPDP_ACT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-inherit no-underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          DPDP
                        </a>
                        {' · export or delete'}
                      </>
                    ) : (
                      row.hint
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {notificationNote && (
            <p
              className="border-t border-border-default px-5 py-3 text-[12px] text-primary"
              style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
            >
              {notificationNote}
            </p>
          )}
        </article>

        <button
          type="button"
          onClick={() => {
            void logout().then(() => {
              navigate('/login', { replace: true });
            });
          }}
          className="mt-4 w-full rounded-full border border-border-default bg-surface-container-low px-2 py-3.5 text-[13px] font-medium text-on-surface-variant"
          style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
        >
          Sign out
        </button>
      </section>

      <BottomNav />
    </main>
  );
}
