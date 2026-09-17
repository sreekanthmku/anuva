import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookIcon, HomeIcon, ShieldIcon } from './ui';

const NAV_ITEMS = [
  { to: '/', labelKey: 'nav.today', Icon: HomeIcon, end: true },
  { to: '/learn', labelKey: 'nav.learn', Icon: BookIcon, end: false },
  { to: '/privacy', labelKey: 'nav.privacy', Icon: ShieldIcon, end: false },
] as const;

/**
 * Three tabs, floating rather than welded to the bottom edge. The pill behind the active icon is
 * the only thing that moves — a nav that animates is a nav that draws attention away from the
 * screen it is navigating.
 */
export function BottomNav() {
  const { t } = useTranslation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-5 pb-[max(env(safe-area-inset-bottom,0px),12px)] pt-2"
      aria-label={t('nav.primary')}
      style={{
        // Fades the page out under the bar instead of drawing a hard rule across it.
        background: 'linear-gradient(to top, #F7F0E8 58%, rgba(247,240,232,0))',
      }}
    >
      <ul className="mx-auto flex max-w-[420px] items-center gap-1 rounded-full border border-secondary/20 bg-surface-raised/95 p-1.5 shadow-lift backdrop-blur-xl">
        {NAV_ITEMS.map(({ to, labelKey, Icon, end }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              className="press flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-full"
            >
              {({ isActive }) => (
                <span
                  className={`flex min-h-[46px] w-full flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
                    isActive ? 'bg-primary-fixed text-primary' : 'text-outline'
                  }`}
                >
                  <Icon size={20} strokeWidth={isActive ? 2 : 1.6} />
                  {/* Indic scripts need the extra leading that `uppercase`/`tracking` were tuned
                      against in Latin — `normal-case` keeps Devanagari and Tamil legible at 9.5px. */}
                  <span
                    className={`px-0.5 text-center text-[9.5px] uppercase leading-[1.25] tracking-[0.12em] ${
                      isActive ? 'font-bold' : 'font-semibold'
                    }`}
                  >
                    {t(labelKey)}
                  </span>
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
