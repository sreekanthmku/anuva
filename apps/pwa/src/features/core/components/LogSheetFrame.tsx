import { useEffect, useId, type ReactNode } from 'react';
import { useDialogA11y } from '../../../lib/a11y/useDialogA11y';

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
  hiddenClose = false,
  children,
}: {
  inline?: boolean;
  onClose: () => void;
  closeLabel: string;
  maxWidthClass?: string;
  fontFamily?: string;
  /**
   * For a form with no close button of its own. The backdrop closes it for a tap, but sits outside
   * the modal where a screen reader cannot reach it, so the same action goes inside, unseen.
   */
  hiddenClose?: boolean;
  children: ReactNode;
}) {
  const ref = useDialogA11y<HTMLDivElement>(!inline, onClose);
  const fallbackTitleId = useId();

  // Named by the form's own heading, whichever one is showing (a two-step form swaps it), so
  // every sheet built on this frame is labelled without each one wiring an id through.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const heading = root.querySelector<HTMLElement>('h1, h2, h3');
    if (!heading) {
      root.removeAttribute('aria-labelledby');
      return;
    }
    if (!heading.id) heading.id = fallbackTitleId;
    root.setAttribute('aria-labelledby', heading.id);
  });

  if (inline) {
    return (
      <div
        ref={ref}
        role="group"
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
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClass} rounded-[20px] border border-border-default bg-surface-raised px-[22px] py-6`}
        style={{ maxHeight: '88dvh', overflowY: 'auto', ...(fontFamily ? { fontFamily } : {}) }}
      >
        {children}
        {hiddenClose && (
          <button type="button" className="sr-only" onClick={onClose}>
            {closeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
