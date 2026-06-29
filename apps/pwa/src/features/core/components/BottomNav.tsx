import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreMenuSheet } from './MoreMenuSheet';

type NavItem = {
  to: string;
  label: string;
  icon: 'home' | 'anu' | 'track' | 'report' | 'more';
  isMore?: boolean;
};

const moreRelatedPaths = ['/care', '/library', '/qa', '/booking', '/profile'];

const navItems: NavItem[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/chat', label: 'ANU', icon: 'anu' },
  { to: '/track', label: 'Track', icon: 'track' },
  { to: '/report', label: 'Report', icon: 'report' },
  { to: '/more', label: 'More', icon: 'more', isMore: true },
];

function NavIcon({ icon, active }: { icon: NavItem['icon']; active: boolean }) {
  const color = active ? '#3E2542' : '#6E5A78';
  const size = 20;

  if (icon === 'home') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 11L12 4l9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-9z"
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (icon === 'anu') {
    return <img src="/anu.png" alt="" className="h-5 w-5 object-contain" />;
  }

  if (icon === 'track') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" stroke={color} strokeWidth="1.6" />
        <path d="M3 10h18M8 3v4M16 3v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === 'report') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 20V10m6 10V4m6 16v-8m6 8v-5"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function BottomNav() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = moreRelatedPaths.includes(location.pathname);

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border-default bg-surface px-1.5 pt-2.5">
        <ul className="flex gap-0.5">
          {navItems.map((item) =>
            item.isMore ? (
              <li key="more" className="flex-1">
                <button
                  type="button"
                  onClick={() => setMoreOpen(true)}
                  className="flex w-full flex-col items-center gap-1 px-0.5 py-1"
                  aria-expanded={moreOpen}
                  aria-haspopup="dialog"
                >
                  <span
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors"
                    style={{ background: moreActive ? '#C97E92' : 'transparent' }}
                  >
                    <NavIcon icon="more" active={moreActive} />
                  </span>
                  <span
                    className="text-[9.5px] uppercase tracking-[0.1em]"
                    style={{
                      fontFamily: '"Mulish", sans-serif',
                      color: moreActive ? '#3E2542' : '#6E5A78',
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              </li>
            ) : (
              <li key={item.to} className="flex-1">
                <NavLink to={item.to} className="flex flex-col items-center gap-1 px-0.5 py-1">
                  {({ isActive }) => (
                    <>
                      <span
                        className="flex h-[38px] w-[38px] items-center justify-center rounded-full transition-colors"
                        style={{ background: isActive ? '#C97E92' : 'transparent' }}
                      >
                        <NavIcon icon={item.icon} active={isActive} />
                      </span>
                      <span
                        className="text-[9.5px] uppercase tracking-[0.1em]"
                        style={{
                          fontFamily: '"Mulish", sans-serif',
                          color: isActive ? '#3E2542' : '#6E5A78',
                        }}
                      >
                        {item.label}
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            )
          )}
        </ul>
        <div className="h-[calc(env(safe-area-inset-bottom,0px)+6px)]" />
      </nav>

      <MoreMenuSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
