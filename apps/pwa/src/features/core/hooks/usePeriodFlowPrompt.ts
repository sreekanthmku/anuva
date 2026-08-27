import { useCallback, useMemo, useState } from 'react';
import type { CycleStateResponse, PeriodFlow } from '@anuva/shared';

/**
 * The home-page period flow prompt.
 *
 * This is an **in-app popup, not a notification** — nothing here schedules,
 * registers or sends anything. It decides whether the modal should be on screen
 * right now, given the cycle state the page already loaded.
 *
 * Two gates, both deliberate:
 *
 *  - Afternoon onward. Flow for a day is only known once the day has been lived;
 *    asking at 08:00 gets an answer about yesterday. Matches the 12:30 afternoon
 *    slot the nudge scheduler already uses.
 *  - Skipped days stay skipped for the session. "Not now" must mean it, or the
 *    modal becomes something to fight past on every render; a fresh app open asks
 *    again, which is what "always ask" is worth in practice.
 */

/** Afternoon onward. No upper bound — 22:00 is a perfectly good time to answer. */
export const FLOW_PROMPT_START_HOUR = 12;

export function inFlowPromptWindow(now: Date = new Date()): boolean {
  return now.getHours() >= FLOW_PROMPT_START_HOUR;
}

/** Session-scoped, per date: a skip should not outlive the app being reopened. */
function skipKey(date: string): string {
  return `anuva.flowPrompt.skipped.${date}`;
}

function isSkipped(date: string): boolean {
  try {
    return window.sessionStorage.getItem(skipKey(date)) === '1';
  } catch {
    // Private mode or blocked storage — better to ask again than to crash.
    return false;
  }
}

function markSkipped(date: string): void {
  try {
    window.sessionStorage.setItem(skipKey(date), '1');
  } catch {
    /* nothing to fall back to; the modal simply reappears next render */
  }
}

/**
 * The day to ask about: the newest bleeding day with no answer that has not been
 * skipped this session. `null` means there is nothing to ask.
 */
export function nextFlowPromptDate(
  pendingFlowDates: string[] | undefined,
  skipped: (date: string) => boolean,
): string | null {
  return (pendingFlowDates ?? []).find((date) => !skipped(date)) ?? null;
}

type UsePeriodFlowPromptArgs = {
  cycleData: CycleStateResponse | null;
  /** Local time, re-read on the dashboard's existing one-minute tick. */
  now: Date;
  onLogFlow: (date: string, flow: PeriodFlow) => Promise<void>;
};

export function usePeriodFlowPrompt({ cycleData, now, onLogFlow }: UsePeriodFlowPromptArgs) {
  const [saving, setSaving] = useState(false);
  // Bumped on skip so the memo below re-reads sessionStorage.
  const [skipTick, setSkipTick] = useState(0);

  const date = useMemo(
    () => nextFlowPromptDate(cycleData?.pendingFlowDates, isSkipped),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cycleData?.pendingFlowDates, skipTick],
  );

  const open = date != null && inFlowPromptWindow(now);

  const save = useCallback(
    async (flow: PeriodFlow) => {
      if (!date) return;
      setSaving(true);
      try {
        // The response carries the recomputed cycle state, so `pendingFlowDates`
        // shrinks by itself and the prompt walks to the next missed day.
        await onLogFlow(date, flow);
      } finally {
        setSaving(false);
      }
    },
    [date, onLogFlow],
  );

  const skip = useCallback(() => {
    if (!date) return;
    markSkipped(date);
    setSkipTick((t) => t + 1);
  }, [date]);

  return { open, date, saving, save, skip };
}
