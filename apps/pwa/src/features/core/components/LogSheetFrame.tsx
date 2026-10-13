import { useEffect, type ReactNode } from 'react';

/**
 * The frame around a tracker's log form. On the Track screen it is a modal over
 * the page; in ANU's chat (`inline`) the same form sits in the thread under the
 * reply, so she logs without a popup covering the conversation.
 */
export function LogSheetFrame({
  inline = false,
  onClose,
  closeLabel,
  maxWidthClass = 'max-w-[360px]',
  fontFamily,
  children,
}: {
  inline?: boolean;
  onClose: () => void;
  closeLabel: string;
  maxWidthClass?: string;
  fontFamily?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (inline) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose]);

  if (inline) {
    return (
      <div
        className="w-full rounded-[18px] border border-primary/25 bg-surface px-4 py-5"
        style={fontFamily ? { fontFamily } : undefined}
      >
        {children}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={closeLabel} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClass} rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6`}
        style={{ maxHeight: '88dvh', overflowY: 'auto', ...(fontFamily ? { fontFamily } : {}) }}
      >
        {children}
      </div>
    </div>
  );
}
