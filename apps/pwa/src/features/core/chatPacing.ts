/**
 * How long a reply sits behind the typing indicator before it appears.
 *
 * Most turns of the probe ladder never reach the model: the middle rungs are
 * authored strings served straight out of `anu/probe/axes.ts`, so they come
 * back in tens of milliseconds — fast enough that the "ANU is typing…" bubble
 * mounts and unmounts in the same frame, and the answer is on screen before
 * she has finished reading her own message. That is what a lookup table feels
 * like. A beat is what a person feels like.
 *
 * The window is deliberately a range rather than a constant: the same delay to
 * the millisecond, every message, is its own kind of machine.
 */
export const MIN_REPLY_DELAY_MS = 2000;
export const MAX_REPLY_DELAY_MS = 3000;

/** A delay for one reply, somewhere in the window. */
export function replyDelay(random: () => number = Math.random): number {
  return MIN_REPLY_DELAY_MS + random() * (MAX_REPLY_DELAY_MS - MIN_REPLY_DELAY_MS);
}

/**
 * What is left of `delayMs` after a request that already took `elapsedMs`.
 *
 * The delay is a floor, never an addition. The turns that do reach the model —
 * the ladder's opening and closing rungs, and every classic answer — already
 * take a second or three, and padding those would punish her for asking the
 * question that needed real thought.
 */
export function remainingDelay(delayMs: number, elapsedMs: number): number {
  return Math.max(0, delayMs - elapsedMs);
}

export function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
