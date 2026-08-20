/**
 * Resolves the 14-day tracking window.
 *
 * Day 1 is the day after her period stops. Anchoring to the cycle rather than to
 * signup makes the window cover the same cycle days for every user, which is what
 * makes log-derived scores comparable between users at all.
 *
 * The honest caveat: no 14-day window inside a ~28-day cycle is phase-neutral.
 * Anchoring buys comparability, not representativeness — a window starting after
 * bleeding covers the follicular and ovulatory phases and ends at or before the
 * late luteal phase, which is where the premenstrual oestrogen drop drives
 * perimenopausal mood symptoms. It therefore under-samples domain B's worst days,
 * consistently and in one direction. That is why logs are blended with the
 * assessment rather than replacing it, and why the blend weight is modest.
 *
 * The anchor is also only available for users who still cycle: a stage 3 user has
 * no period to anchor to, and neither does a post-hysterectomy user. Hence the
 * fallback chain.
 */

import { REPORT14_CONFIG as CFG } from '../config.js';
import type { PeriodRow } from '../data/load.js';
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
  periods: PeriodRow[];
  periodLengthDays: number | null;
  assessmentCompletedAt: Date | null;
  firstLogAt: Date | null;
  now: Date;
}

export function resolveWindow(input: WindowInput): WindowResult {
  const { periods, periodLengthDays, assessmentCompletedAt, firstLogAt, now } = input;
  const windowDays = CFG.windowDays;

  // Most recent period at or after the assessment — the report describes the
  // window that followed her assessment, not a cycle from before it.
  const eligible = periods
    .filter((p) => {
      if (!assessmentCompletedAt) return true;
      const assessmentDay = new Date(assessmentCompletedAt);
      assessmentDay.setHours(0, 0, 0, 0);
      return p.startDate.getTime() >= addDays(assessmentDay, -CFG.anchorWaitDays).getTime();
    })
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime());

  const mostRecent = eligible[0];

  if (
    (CFG.windowAnchor === 'day_after_bleeding' || CFG.windowAnchor === 'cycle_day_1') &&
    mostRecent
  ) {
    let anchor: Date;
    let basis: string;

    if (CFG.windowAnchor === 'cycle_day_1') {
      anchor = addDays(mostRecent.startDate, CFG.anchorOffsetDays);
      basis = 'first day of bleeding';
    } else {
      // Day after bleeding stops. `endDate` is authoritative when the user
      // closed the period out; otherwise fall back to her own configured period
      // length, then to the module default.
      const bleedEnd =
        mostRecent.endDate ??
        addDays(mostRecent.startDate, (periodLengthDays ?? CFG.fallbackPeriodLengthDays) - 1);
      anchor = addDays(bleedEnd, 1 + CFG.anchorOffsetDays);
      basis = mostRecent.endDate
        ? 'day after logged period end'
        : `day after estimated period end (${periodLengthDays ?? CFG.fallbackPeriodLengthDays}-day bleed)`;
    }

    const end = addDays(anchor, windowDays - 1);
    const elapsed = daysBetween(anchor, now) + 1;

    return {
      anchorMode: CFG.windowAnchor,
      start: anchor,
      end,
      daysCovered: Math.max(0, Math.min(windowDays, elapsed)),
      reason: `Anchored to ${basis}.`,
    };
  }

  // Fallback 1 — her earliest log. Used when no period start is available
  // inside the wait window, which is the normal case for stage 3 and
  // post-hysterectomy users.
  if (firstLogAt) {
    const start = addDays(firstLogAt, 0);
    const end = addDays(start, windowDays - 1);
    const elapsed = daysBetween(start, now) + 1;
    return {
      anchorMode: 'first_log',
      start,
      end,
      daysCovered: Math.max(0, Math.min(windowDays, elapsed)),
      reason:
        'No period start available to anchor to — using the first logged day. ' +
        'Log scores from this window are not directly comparable with cycle-anchored ones.',
    };
  }

  // Fallback 2 — no logs at all. There is no window, and that is a supported
  // outcome: the classification is assessment-driven by design.
  return {
    anchorMode: 'assessment',
    start: null,
    end: null,
    daysCovered: 0,
    reason: 'No cycle anchor and no logs — classified from the assessment alone.',
  };
}
