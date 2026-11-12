import { useLayoutEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Every new screen opens at the top. A single-page app keeps the page's scroll position across
 * screen changes (a real page load would reset it, and BrowserRouter does not), so a screen that
 * scrolls the page — the assessment questions on a small iPhone — left the next one scrolled down
 * too. On a full-height screen with its own scroll area, like the assessment result, that pushed it
 * up under the status bar with an empty band at the bottom until she touched it.
 *
 * Keyed on the path only: a change of query or hash on the same screen keeps its position.
 * Before paint (layout effect), so the shifted screen never shows. Not on first load, where the
 * browser decides.
 */
export function ScrollReset() {
  const { pathname } = useLocation();
  const first = useRef(true);

  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
