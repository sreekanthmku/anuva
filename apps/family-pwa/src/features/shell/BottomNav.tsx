import { NavLink } from 'react-router-dom';
import { BookIcon, HomeIcon, ShieldIcon } from './ui';

const NAV_ITEMS = [
  { to: '/', label: 'Today', Icon: HomeIcon, end: true },
  { to: '/learn', label: 'Learn', Icon: BookIcon, end: false },
  { to: '/privacy', label: 'Privacy', Icon: ShieldIcon, end: false },
] as const;

export function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-default bg-surface-raised/95 backdrop-blur"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-[560px] px-2 pt-2">
        {NAV_ITEMS.map(({ to, label, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink to={to} end={end} className="flex min-h-[52px] flex-col items-center justify-center gap-1">
              {({ isActive }) => (
                <>
                  <span
                    className={`relative flex h-[34px] w-[54px] items-center justify-center rounded-full transition-colors ${
                      isActive ? 'bg-primary-fixed text-primary' : 'text-outline'
                    }`}
                  >
                    <Icon size={21} strokeWidth={isActive ? 1.9 : 1.6} />
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
