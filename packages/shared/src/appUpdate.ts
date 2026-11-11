// When an installed app may switch to a new version it has already downloaded.
//
// The service worker fetches a new deploy in the background and then waits. Reloading onto it is
// free if the person has not started anything, and costly if they have: a live consultation call
// drops, a code they are about to type from the voice call is lost, half-written text is gone. So:
//
//   a screen holds it (a call, a code step)       → wait, and do not even offer
//   nothing touched since opening or coming back  → reload now; it looks like the app launching
//   otherwise                                     → offer a "new version" bar they can tap
//
// The apps wire this up in src/lib/pwa/appUpdate.ts; this file is only the rule, so it is tested
// once for all three.

/** Away at least this long and coming back counts as a fresh start, like opening the app. */
export const APP_UPDATE_FRESH_AFTER_AWAY_MS = 60_000;

/** How often an app that stays open on screen asks for a new version. */
export const APP_UPDATE_CHECK_INTERVAL_MS = 30 * 60_000;

export type AppUpdateDecision = 'reload' | 'offer' | 'wait';

export type AppUpdateMoment = {
  /** A screen has said a reload now would lose something: a live call, a code being entered. */
  held: boolean;
  /** Nothing tapped or typed since the app opened, or since it came back after being away. */
  untouched: boolean;
  /** Text is sitting in a field on screen. */
  hasTypedText: boolean;
};

export function decideAppUpdate(moment: AppUpdateMoment): AppUpdateDecision {
  if (moment.held) return 'wait';
  if (moment.untouched && !moment.hasTypedText) return 'reload';
  return 'offer';
}

/** Whether coming back after `awayMs` hidden counts as a fresh start. */
export function isFreshReturn(awayMs: number): boolean {
  return awayMs >= APP_UPDATE_FRESH_AFTER_AWAY_MS;
}
