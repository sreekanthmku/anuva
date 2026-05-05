import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export type MoreMenuItem = {
  num: string;
  to: string;
  label: string;
};

const items: MoreMenuItem[] = [
  { num: '08', to: '/profile', label: 'Profile' },
  { num: '09', to: '/care', label: 'Care Direction' },
  { num: '10', to: '/library', label: 'Library' },
  { num: '11', to: '/qa', label: 'Anonymous Q&A' },
  { num: '12', to: '/booking', label: 'Consultation Booking' },
];

type MoreMenuSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function MoreMenuSheet({ open, onClose }: MoreMenuSheetProps) {
  const navigate = useNavigate();

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
        aria-label="Close menu"
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[61] rounded-t-[28px] border border-b-0 border-border-default bg-surface px-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="more-menu-title"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-outline/40" />
        <h2 id="more-menu-title" className="sr-only">
          More destinations
        </h2>
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={item.to}>
              <button
                type="button"
                onClick={() => go(item.to)}
                className="flex w-full items-center gap-4 rounded-starchart-lg border border-transparent px-3 py-3.5 text-left transition-colors hover:border-border-default hover:bg-surface-container-low"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-[12px] text-primary"
                  style={{ fontFamily: '"Geist Mono", ui-monospace, monospace' }}
                >
                  {item.num}
                </span>
                <span className="text-[15px] text-on-surface" style={{ fontFamily: '"Geist", -apple-system, system-ui, sans-serif' }}>
                  {item.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
