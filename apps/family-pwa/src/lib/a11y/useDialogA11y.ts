import { useEffect, useRef } from 'react';

/**
 * Screen-reader and keyboard behaviour for a sheet or dialog, with nothing visible added.
 *
 * While `open`: focus moves onto the dialog itself, so a screen reader reads its title first; Tab
 * and Shift+Tab then move through its controls and stay inside it, and Escape calls `onClose` when
 * one is given. On close, focus goes back to whatever opened it, so a screen-reader user is not
 * dropped at the top of the page.
 *
 * The dialog, not its first button: a dialog that opens by itself (an alert, a thank-you) would
 * otherwise show a focus ring on that button, and a stray Enter would press it — on the emergency
 * alert, that is "Call 112". The dialog takes `tabindex="-1"`, which never shows a ring.
 *
 * Attach the returned ref to the element that carries `role="dialog"` and `aria-modal="true"`.
 * Stacked dialogs are handled: only the topmost one traps focus and answers Escape.
 */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

const stack: HTMLElement[] = [];

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.hasAttribute('inert') && el.getAttribute('aria-hidden') !== 'true' && el.getClientRects().length > 0,
  );
}

export function useDialogA11y<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose?: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    stack.push(root);

    // After paint, so a sheet that renders a frame late still gets focus. A dialog that already
    // put focus somewhere inside itself keeps it.
    const frame = window.requestAnimationFrame(() => {
      if (root.contains(document.activeElement)) return;
      if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
      root.focus({ preventScroll: true });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (stack[stack.length - 1] !== root) return;
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables(root);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === root || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      const index = stack.lastIndexOf(root);
      if (index !== -1) stack.splice(index, 1);
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

  return ref;
}
