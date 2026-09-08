/**
 * "Are we running inside the installed app, or in a browser tab?"
 *
 * This is deliberately a display-mode question rather than an is-it-installed
 * question. Someone can have the app installed and still be browsing the site
 * in a tab, and in that case they must see the install gate, not the app.
 */

type IosNavigator = Navigator & { standalone?: boolean };

const STANDALONE_QUERIES = [
  '(display-mode: standalone)',
  '(display-mode: fullscreen)',
  '(display-mode: minimal-ui)',
];

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  // iOS predates the display-mode media feature for home-screen web apps and
  // only exposes this flag, so it has to be checked first.
  if ((window.navigator as IosNavigator).standalone === true) return true;

  if (typeof window.matchMedia !== 'function') return false;
  return STANDALONE_QUERIES.some((query) => window.matchMedia(query).matches);
}

/**
 * Display mode can change without a reload — a desktop PWA window can be moved
 * back into a tab, and Chrome fires the media query change when it does.
 */
export function subscribeToDisplayMode(onChange: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const lists = STANDALONE_QUERIES.map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener('change', onChange));
  return () => lists.forEach((list) => list.removeEventListener('change', onChange));
}
