import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * On every screen change, moves focus to the new screen's main heading, so a screen reader reads
 * where she has arrived instead of staying on the button she tapped (now gone). Not on first
 * load: the screen reader starts at the top of the page by itself.
 *
 * The heading gets `tabindex="-1"` so it can take focus without becoming a Tab stop, and no focus
 * ring shows on it (see index.css). Nothing visible changes.
 */
export function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    // A frame later, once the new screen has rendered its heading.
    const frame = window.requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('main h1') ??
        document.querySelector<HTMLElement>('h1') ??
        document.querySelector<HTMLElement>('main');
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}
