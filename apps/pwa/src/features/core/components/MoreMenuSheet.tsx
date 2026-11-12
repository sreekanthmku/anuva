import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CalendarHeart,
  Compass,
  MessageCircleQuestionMark,
  NotebookPen,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';
import { useAuth } from '../../auth/auth-context';

export type MoreMenuItem = {
  to: string;
  /** Resolved through `t()` at render; see `nav.*`. */
  labelKey: string;
  icon: LucideIcon;
};

const items: MoreMenuItem[] = [
  { to: '/profile', labelKey: 'nav.profile', icon: UserRound },
  { to: '/care', labelKey: 'nav.careDirection', icon: Compass },
  { to: '/library', labelKey: 'nav.library', icon: BookOpen },
  { to: '/qa', labelKey: 'nav.anonymousQa', icon: MessageCircleQuestionMark },
  { to: '/booking', labelKey: 'nav.consultationBooking', icon: CalendarHeart },
  { to: '/notes', labelKey: 'nav.notes', icon: NotebookPen },
];

type MoreMenuSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function MoreMenuSheet({ open, onClose }: MoreMenuSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Care Direction leads to a consultation, which an alpha account not on a paid plan cannot book.
  const locked = useAuth().user?.consultationBookingLocked ?? false;
  const visible = locked ? items.filter((item) => item.to !== '/care') : items;
  // Focus in, Tab trap, focus back to More. Escape is the listener below.
  const dialogRef = useDialogA11y<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const go = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] cursor-default border-none bg-black/60 p-0"
        onClick={onClose}
        aria-label={t('nav.closeMenu')}
      />
      <div
        ref={dialogRef}
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" aria-hidden="true" />
        <h2 id="more-menu-title" className="sr-only">
          {t('nav.moreDestinations')}
        </h2>
        <ul className="flex flex-col gap-1">
          {visible.map((item) => (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => go(item.to)}
                className="flex w-full items-center gap-4 rounded-[20px] border border-transparent px-3 py-3.5 text-left transition-colors hover:border-border-default hover:bg-surface-container-low"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary"
                >
                  <item.icon size={18} strokeWidth={1.8} />
                </span>
                <span
                  className="text-[15px] text-on-surface"
                  style={{ fontFamily: '"Mulish", -apple-system, system-ui, sans-serif' }}
                >
                  {t(item.labelKey)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
