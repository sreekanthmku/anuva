import { useEffect, useRef } from 'react';

/**
 * Keeping lists of free times honest.
 *
 * Every screen that offers times — the booking screen, ANU's booking card in chat (one per reply,
 * and older ones stay on screen), the reschedule sheet — loads them once when it opens. Without
 * this, a time she had just booked elsewhere in the app, or that someone else had taken, stayed on
 * offer until she tapped it and was refused.
 *
 * So a list reloads when a booking, reschedule or cancel anywhere in the app says times changed,
 * when the app comes back on screen, and once a minute while it is visible (for times taken by
 * other people, which nothing on this device can announce).
 */

const SLOTS_CHANGED = 'anuva:slots-changed';
const POLL_MS = 60_000;

/** A booking, reschedule or cancel just changed which times are free. */
export function announceSlotsChanged(): void {
  window.dispatchEvent(new Event(SLOTS_CHANGED));
}

/** Calls `reload` whenever the times on offer may have changed, while `enabled`. */
export function useSlotsRefresh(reload: () => void, enabled = true): void {
  const latest = useRef(reload);
  latest.current = reload;

  useEffect(() => {
    if (!enabled) return;
    const run = () => latest.current();
    const onVisible = () => {
      if (document.visibilityState === 'visible') run();
    };
    const timer = window.setInterval(onVisible, POLL_MS);
    window.addEventListener(SLOTS_CHANGED, run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SLOTS_CHANGED, run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
}
