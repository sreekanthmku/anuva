import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_REPLY_DELAY_MS,
  MIN_REPLY_DELAY_MS,
  remainingDelay,
  replyDelay,
  wait,
} from '../src/features/core/chatPacing';

describe('replyDelay', () => {
  it('sits inside the 2-3 second window', () => {
    expect(replyDelay(() => 0)).toBe(MIN_REPLY_DELAY_MS);
    expect(replyDelay(() => 0.5)).toBe(2500);
    // Math.random() never returns 1, so the ceiling is a limit, not a value.
    expect(replyDelay(() => 0.999)).toBeLessThan(MAX_REPLY_DELAY_MS);
    expect(replyDelay(() => 0.999)).toBeGreaterThan(MIN_REPLY_DELAY_MS);
  });

  it('varies between calls, so the beat is not identical every message', () => {
    const delays = new Set(Array.from({ length: 50 }, () => replyDelay()));
    expect(delays.size).toBeGreaterThan(1);
  });

  it('defaults to Math.random and stays in range across many draws', () => {
    for (let i = 0; i < 200; i += 1) {
      const d = replyDelay();
      expect(d).toBeGreaterThanOrEqual(MIN_REPLY_DELAY_MS);
      expect(d).toBeLessThan(MAX_REPLY_DELAY_MS);
    }
  });
});

describe('remainingDelay', () => {
  it('holds a fast reply for the rest of the window', () => {
    // A probe rung served from the axes registry: ~30ms of Postgres.
    expect(remainingDelay(2400, 30)).toBe(2370);
  });

  it('is a floor, not an addition — a slow model reply ships at once', () => {
    expect(remainingDelay(2400, 3200)).toBe(0);
    expect(remainingDelay(2400, 2400)).toBe(0);
  });

  it('never returns a negative wait', () => {
    expect(remainingDelay(2000, 99_999)).toBe(0);
  });
});

describe('wait', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately for a non-positive delay, without a timer', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(globalThis, 'setTimeout');
    const done = wait(0);
    expect(spy).not.toHaveBeenCalled();
    return done;
  });

  it('resolves after the delay elapses', async () => {
    vi.useFakeTimers();
    let settled = false;
    const done = wait(2500).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(2499);
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(settled).toBe(true);
  });
});
