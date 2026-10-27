// Which day a tracker entry may be for: today, or yesterday — never further back, never ahead.
//
// The app logs for today unless she switches the Track screen to yesterday, and then it sends a
// `loggedAt` (or, for joints, a `date`) inside yesterday. Every write route runs the client's value
// through here, so "one day back" holds whatever a client sends — before this, `/mood`, `/sleep`,
// `/quick-log` and `/nudge/respond` would store any timestamp at all.

import { copy } from './i18n/index.js';
import { localDayStart } from './dayKey.js';

/// How many days back she may fill in.
export const TRACKING_BACKFILL_DAYS = 1;

/// A phone a few minutes ahead of the server is not logging the future.
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const TRACKING_DAY_TEXT = copy('errors', {
  trackingDayOutOfRange: 'You can add entries for today or yesterday only.',
});

/** Local midnight at the start of the earliest day she may still log for. */
export function earliestTrackingDay(now = new Date()): Date {
  const start = localDayStart(now);
  start.setDate(start.getDate() - TRACKING_BACKFILL_DAYS);
  return start;
}

/**
 * The timestamp to store for an entry: `now` when the client sent none, its own `loggedAt` when that
 * falls today or yesterday (clamped to `now` inside the skew allowance), otherwise null — the route
 * answers 400.
 */
export function trackingTime(loggedAt: string | undefined, now = new Date()): Date | null {
  if (!loggedAt) return now;
  const at = new Date(loggedAt);
  if (Number.isNaN(at.getTime())) return null;
  if (at.getTime() > now.getTime() + CLOCK_SKEW_MS) return null;
  if (at < earliestTrackingDay(now)) return null;
  return at > now ? now : at;
}

/** The same rule for a `YYYY-MM-DD` day (joints). True when it is today or yesterday. */
export function isTrackingDate(ymd: string, now = new Date()): boolean {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return false;
  const day = new Date(y, m - 1, d);
  return day >= earliestTrackingDay(now) && day <= localDayStart(now);
}
