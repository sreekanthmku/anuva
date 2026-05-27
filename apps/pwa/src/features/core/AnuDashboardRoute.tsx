import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BottomNav } from './components/BottomNav';
import { NotificationPermissionDialog } from './components/NotificationPermissionDialog';
import { NotificationSyncBanner } from './components/NotificationSyncBanner';
import { useHomeNotificationPrompt } from './hooks/useHomeNotificationPrompt';

const quickLogItems = [
  { label: 'Hot flash', sub: 'Log now', tone: '#F87171', count: '2 TODAY' },
  { label: 'Sleep', sub: 'Rate last night', tone: '#cebdff' },
  { label: 'Mood', sub: 'How are you?', tone: '#dbc839' },
  { label: 'Cycle', sub: 'Day 24', tone: '#e2c62d' },
];

const score = 72;
const circumference = 2 * Math.PI * 42;
const scoreDash = (score / 100) * circumference;

function getTimeGreeting(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Good morning';
  }

  if (hour >= 12 && hour < 17) {
    return 'Good afternoon';
  }

  if (hour >= 17 && hour < 21) {
    return 'Good evening';
  }

  return 'Good night';
}

export default function AnuDashboardRoute() {
  const { user } = useAuth();
  const notificationPrompt = useHomeNotificationPrompt();
  const [greeting, setGreeting] = useState(() => getTimeGreeting());
  const firstName = user?.name?.trim().split(/\s+/)[0] || 'there';
  const profileInitial = firstName.charAt(0).toUpperCase() || 'U';

  useEffect(() => {
    const updateGreeting = () => setGreeting(getTimeGreeting());

    updateGreeting();
    const intervalId = window.setInterval(updateGreeting, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <main className="h-[100dvh] min-h-mobile overflow-x-hidden overflow-y-auto bg-surface pb-28 pt-[40px] text-on-surface">
      <NotificationPermissionDialog
        open={notificationPrompt.open}
        isRegistering={notificationPrompt.isRegistering}
        onAccept={notificationPrompt.accept}
        onDismiss={notificationPrompt.dismiss}
      />
      <section className="px-[22px] pb-[14px]">
        {notificationPrompt.syncMessage && (
          <NotificationSyncBanner
            message={notificationPrompt.syncMessage}
            onRetry={notificationPrompt.retrySync}
            onDismiss={notificationPrompt.clearSyncMessage}
          />
        )}

        <header className="mb-[18px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/anu.png" alt="Anuva logo" className="h-5 w-5 object-contain" />
            <span
              className="text-[16px] tracking-[0.16em] text-on-surface"
              style={{ fontFamily: '"DM Sans", sans-serif', fontWeight: 500 }}
            >
              ANUVA
            </span>
          </div>
          <NavLink
            to="/profile"
            aria-label="Open profile"
            className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[14px] text-primary transition-opacity hover:opacity-90"
            style={{
              background: '#1d1a21',
              borderColor: 'rgba(148, 142, 157, 0.35)',
              fontFamily: '"DM Sans", sans-serif',
              fontWeight: 500,
            }}
          >
            {profileInitial}
          </NavLink>
        </header>

        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-primary">
          <span className="h-px w-3 bg-primary/60" />
          <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>{greeting}</span>
        </div>

        <h1
          className="font-display mb-2.5 text-[34px] leading-[1] text-on-surface"
        >
          <em className="not-italic text-primary" style={{ fontStyle: 'italic', fontWeight: 300 }}>
            {firstName}
          </em>
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10.5px] uppercase tracking-[0.12em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Day 8 · Week 2
          </span>
          <span className="text-outline/40">·</span>
          <span
            className="rounded-full border px-[9px] py-[3px] text-[9.5px] uppercase tracking-[0.1em]"
            style={{
              background: 'rgba(219, 200, 57, 0.16)',
              borderColor: 'rgba(219, 200, 57, 0.3)',
              color: '#dbc839',
              fontFamily: '"Geist Mono", ui-monospace, monospace',
            }}
          >
            ● Perimenopause
          </span>
        </div>
      </section>

      <section className="px-[22px]">
        <article className="flex items-center gap-4 rounded-[24px] border border-border-default bg-gradient-to-br from-surface-raised to-deep-space px-5 py-[18px]">
          <div className="relative h-24 w-24 shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#2b2930" strokeWidth="6" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="#cebdff"
                strokeWidth="6"
                strokeDasharray={`${scoreDash} ${circumference}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="text-[30px] leading-none text-on-surface"
              >
                {score}
              </span>
              <span className="mt-1 text-[8.5px] uppercase tracking-[0.18em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                balance
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div className="mb-1.5 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
              <span className="h-px w-3 bg-primary/60" />
              <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Today&apos;s wellness</span>
            </div>
            <p
              className="mb-2 text-[18px] leading-[1.25] text-on-surface"
              style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
            >
              Steady, with gentle friction.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Sleep +12%
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-error" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-error" />
                Hot flashes ↑
              </span>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-[14px]">
        <article className="rounded-[24px] border border-border-default bg-surface-container-low px-[18px] py-4">
          <div className="flex items-start gap-3.5">
            <img src="/anu.png" alt="ANU avatar" className="mt-0.5 h-[26px] w-[26px] shrink-0 object-contain" />
            <div className="flex-1">
              <div className="mb-2 flex items-center gap-2 text-[9.5px] uppercase tracking-[0.18em] text-primary">
                <span className="h-px w-3 bg-primary/60" />
                <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>ANU · just now</span>
              </div>
              <p
                className="text-[16px] leading-[1.4] text-on-surface"
                style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}
              >
                &quot;You logged two hot flashes yesterday. Want me to suggest a 3-minute cooling ritual for tonight?&quot;
              </p>
              <div className="mt-3 flex gap-1.5">
                <button type="button" className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1.5 text-[12px] text-primary" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Yes, show me
                </button>
                <button type="button" className="rounded-full border border-border-default bg-surface px-3 py-1.5 text-[12px] text-on-surface-variant" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  Later
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="px-[22px] pt-4">
        <div className="mb-2.5 flex items-baseline justify-between">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-outline">
            <span className="h-px w-3 bg-outline/60" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Quick log</span>
          </div>
          <span className="text-[10px] uppercase tracking-[0.1em] text-outline" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
            Tap to track
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {quickLogItems.map((item) => (
            <article key={item.label} className="rounded-[20px] border border-border-default bg-surface-container-low p-[14px]">
              <div className="mb-3 flex items-center justify-between">
                <span className="h-[30px] w-[30px] rounded-full" style={{ background: item.tone }} />
                {item.count && (
                  <span className="text-[9.5px] uppercase tracking-[0.08em] text-error" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
                    {item.count}
                  </span>
                )}
              </div>
              <p className="text-[13px] font-medium text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {item.label}
              </p>
              <p className="mt-0.5 text-[11px] text-outline" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                {item.sub}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-[22px] pt-4">
        <article
          className="overflow-hidden rounded-[28px] border px-5 py-5"
          style={{
            background: 'linear-gradient(145deg, rgba(36, 25, 47, 0.96), rgba(24, 18, 37, 0.98))',
            borderColor: 'rgba(206, 189, 255, 0.18)',
            boxShadow: '0 16px 40px rgba(0,0,0,0.32)',
          }}
        >
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#dbc839' }}>
            <span className="h-px w-3 bg-[#dbc839]/70" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Next step required</span>
          </div>

          <p
            className="max-w-[24ch] text-[17px] leading-[1.4] text-on-surface"
            style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic', fontWeight: 300 }}
          >
            Let&apos;s go deeper with your assessment
          </p>

          <p
            className="mt-3 max-w-[28ch] text-[12px] leading-[1.5]"
            style={{ color: '#b5acbf', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}
          >
            Your detailed assessment helps ANU personalise your care path. Takes about 8 minutes.
          </p>

          <button
            type="button"
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-secondary px-[22px] py-[14px] text-[14px] font-medium text-inverse-on-surface"
            style={{
              fontFamily: '"Geist", -apple-system, system-ui, sans-serif',
              fontWeight: 500,
              letterSpacing: '-0.005em',
            }}
          >
            Start detailed assessment
            <span aria-hidden="true">→</span>
          </button>
        </article>
      </section>

      <section className="px-[22px] pb-[22px] pt-4">
        <article className="rounded-[24px] border px-[18px] py-4" style={{ background: 'rgba(219, 200, 57, 0.16)', borderColor: 'rgba(219, 200, 57, 0.3)' }}>
          <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em]" style={{ color: '#dbc839' }}>
            <span className="h-px w-3 bg-[#dbc839]/70" />
            <span style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>Today&apos;s insight</span>
          </div>
          <p className="text-[17px] leading-[1.4] text-on-surface" style={{ fontFamily: '"DM Sans", sans-serif', fontStyle: 'italic' }}>
            Cooling the bedroom to 22°C before sleep can reduce night sweats by up to 40%.
          </p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant" style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}>
              Dr. Meera Rao · AIIMS
            </span>
            <span className="text-[12px] font-medium" style={{ color: '#dbc839', fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
              Read →
            </span>
          </div>
        </article>
      </section>

      <BottomNav />
    </main>
  );
}
