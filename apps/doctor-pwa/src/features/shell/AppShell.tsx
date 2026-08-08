import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDoctorIdentity } from '../auth/identity';
import { useNotifications } from '../notifications/store';
import { BottomNav } from './BottomNav';
import { BellIcon } from './icons';

export function initialsOf(name: string): string {
  const parts = name
    .replace(/^(dr\.?|prof\.?)\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'AN';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();

  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-primary-fixed font-display text-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * The identity bar every authenticated screen carries: who is signed in on the left, the alert
 * bell on the right. Navigation itself lives in the bottom nav, so nothing here competes with it.
 */
function TopBar() {
  const navigate = useNavigate();
  const identity = useDoctorIdentity();
  const { unreadCount } = useNotifications();

  const isAdmin = identity.scope === 'admin';
  const displayName = isAdmin ? 'Anuva admin' : (identity.specialistName ?? identity.username);

  return (
    <header className="sticky top-0 z-30 border-b border-border-default bg-surface/90 backdrop-blur">
      <div className="mx-auto flex max-w-[560px] items-center gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-[17px] leading-tight text-on-surface">
            {displayName}
          </div>
          <div className="mt-0.5 text-[10.5px] uppercase tracking-[0.14em] text-outline">
            {isAdmin ? 'Admin access · all doctors' : 'Specialist portal'}
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
          className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-border-default bg-surface-raised text-primary"
        >
          <BellIcon size={20} />
          {unreadCount > 0 ? (
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-secondary ring-2 ring-surface-raised" />
          ) : null}
        </button>
      </div>
    </header>
  );
}

/** Page chrome for every tab: identity bar on top, bottom nav below, content in between. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-mobile bg-surface text-on-surface">
      <TopBar />
      <main className="mx-auto max-w-[560px] px-4 pb-[calc(96px+env(safe-area-inset-bottom,0px))] pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

/** The title block a tab opens with — one voice across the portal. */
export function PageHeading({
  eyebrow,
  title,
  accent,
  description,
}: {
  eyebrow?: string;
  title: string;
  /** Rendered in plum right after the title, the way the patient app emphasises a heading. */
  accent?: string;
  description?: string;
}) {
  return (
    <div className="mb-4">
      {eyebrow ? (
        <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.16em] text-tertiary">{eyebrow}</div>
      ) : null}
      <h1 className="font-display text-[27px] leading-[1.12] text-on-surface">
        {title}
        {accent ? <span className="text-primary"> {accent}</span> : null}
      </h1>
      {description ? (
        <p className="mt-2 text-[13px] leading-[1.55] text-on-surface-variant">{description}</p>
      ) : null}
    </div>
  );
}
