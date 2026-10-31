/**
 * Resolves the 14-day tracking window.
 *
 * Day 1 is the first day of her trial — the same day the home card counts as
 * "Day 1 of 14" (`journeyStart` in ../../report/calendar.ts). So every user's
 * window is trial days 1–14, and the report is complete on day 15.
 *
 * Her cycle plays no part in where the window sits. Anchoring to the day after
 * a period would make windows comparable between users, but it also made the
 * report's day a moving target she could not see, and left users who no longer
 * cycle on a fallback. One rule for everyone is the product decision; the
 * cycle-phase skew that follows is why logs are blended with the assessment
 * rather than replacing it.
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import type { WindowResult } from '../types.js';

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export interface WindowInput {
  /** The day her trial started, or the day she signed up if she has not started one. */
  journeyStartAt: Date;
  now: Date;
}

export function resolveWindow(input: WindowInput): WindowResult {
  const { journeyStartAt, now } = input;
  const start = addDays(journeyStartAt, 0);
  const end = addDays(start, CFG.windowDays - 1);
  const elapsed = daysBetween(start, addDays(now, 0)) + 1;

  return {
    anchorMode: 'trial_start',
    start,
    end,
    daysCovered: Math.max(0, Math.min(CFG.windowDays, elapsed)),
    reason: 'Anchored to the first day of her trial.',
  };
}
