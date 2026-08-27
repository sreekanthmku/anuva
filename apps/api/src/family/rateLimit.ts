/**
 * A fixed-window counter for the one unauthenticated route in this module.
 *
 * In-memory, so it is per-process: two API containers each allow the budget, and a restart clears
 * it. That is acceptable for what it protects — the invite preview leaks only a first name, and the
 * expensive path behind it (sending an SMS) is separately limited per phone number through
 * `OtpChallenge` rows, which are in Postgres and therefore shared. If this ever needs to be strict,
 * it wants Redis, not a bigger map.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Bounded so a flood of distinct keys cannot grow the map without limit. */
const MAX_KEYS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [candidate, window] of windows) {
        if (window.resetAt <= now) windows.delete(candidate);
      }
      if (windows.size >= MAX_KEYS) {
        // Still full of live windows: fail closed rather than stop counting.
        return false;
      }
    }
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count += 1;
  return true;
}

/** Test seam. */
export function resetRateLimits(): void {
  windows.clear();
}
