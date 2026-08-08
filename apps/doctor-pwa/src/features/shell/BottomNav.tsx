import { NavLink } from 'react-router-dom';
import { useNotifications } from '../notifications/store';
import { BellIcon, CalendarIcon, ChatIcon, UserIcon } from './icons';

type NavItem = {
  to: string;
  label: string;
  Icon: typeof CalendarIcon;
};

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Schedule', Icon: CalendarIcon },
  { to: '/questions', label: 'Q&A', Icon: ChatIcon },
  { to: '/notifications', label: 'Alerts', Icon: BellIcon },
  { to: '/profile', label: 'Profile', Icon: UserIcon },
];

function Badge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1.5 -top-1 min-w-[18px] rounded-full bg-secondary px-1 text-center font-mono text-[10px] font-bold leading-[18px] text-on-secondary ring-2 ring-surface-raised">
      {count > 9 ? '9+' : count}
    </span>
  );
}

export function BottomNav() {
  const { unreadCount } = useNotifications();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-raised/95 backdrop-blur">
      <ul className="mx-auto flex max-w-[560px] px-2 pt-2">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              // `end` only on the schedule tab: it is the index route, so without it every path
              // would light it up.
              end={to === '/'}
              className="flex min-h-[52px] flex-col items-center justify-center gap-1"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`relative flex h-[34px] w-[54px] items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-fixed text-primary' : 'text-outline'
                    }`}
                  >
                    <Icon size={21} strokeWidth={isActive ? 1.9 : 1.6} />
                    {to === '/notifications' ? <Badge count={unreadCount} /> : null}
                  </span>
                  <span
                    className={`text-[10px] uppercase tracking-[0.1em] ${
                      isActive ? 'font-semibold text-primary' : 'text-outline'
                    }`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="h-[max(env(safe-area-inset-bottom,0px),8px)]" />
    </nav>
  );
}
