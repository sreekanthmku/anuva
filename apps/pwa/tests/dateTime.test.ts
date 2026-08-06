import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DATES_PER_PAGE,
  addDays,
  bookingDateCard,
  dateAtLocalNoonFromTodayOffset,
  formatBookingDateLong,
  formatBookingTimeLabel,
  localYmd,
} from '../src/features/core/booking/dateTime';

describe('DATES_PER_PAGE', () => {
  it('is 6', () => {
    expect(DATES_PER_PAGE).toBe(6);
  });
});

describe('localYmd', () => {
  it('formats a local calendar date as YYYY-MM-DD with zero-padded month/day', () => {
    expect(localYmd(new Date(2024, 0, 5, 23, 59, 59))).toBe('2024-01-05');
    expect(localYmd(new Date(2024, 8, 9, 0, 0, 0))).toBe('2024-09-09');
    expect(localYmd(new Date(2024, 11, 31, 12, 0, 0))).toBe('2024-12-31');
  });

  it('uses local date parts, not UTC (evening near UTC day boundary)', () => {
    // 2024-06-15 23:30 local — still the 15th regardless of timezone offset.
    const local = new Date(2024, 5, 15, 23, 30, 0);
    expect(localYmd(local)).toBe('2024-06-15');
  });
});

describe('addDays', () => {
  it('returns a new Date without mutating the input', () => {
    const input = new Date(2024, 0, 10, 15, 30, 0);
    const next = addDays(input, 3);
    expect(localYmd(next)).toBe('2024-01-13');
    expect(localYmd(input)).toBe('2024-01-10');
    expect(next).not.toBe(input);
  });

  it('handles month and year rollover', () => {
    expect(localYmd(addDays(new Date(2024, 0, 31), 1))).toBe('2024-02-01');
    expect(localYmd(addDays(new Date(2024, 11, 31), 1))).toBe('2025-01-01');
  });

  it('supports zero and negative offsets', () => {
    const base = new Date(2024, 5, 15, 12, 0, 0);
    expect(localYmd(addDays(base, 0))).toBe('2024-06-15');
    expect(localYmd(addDays(base, -5))).toBe('2024-06-10');
  });

  it('preserves local time-of-day when crossing DST-safe noon anchors', () => {
    const noon = new Date(2024, 5, 1, 12, 0, 0, 0);
    const next = addDays(noon, 10);
    expect(next.getHours()).toBe(12);
    expect(next.getMinutes()).toBe(0);
  });
});

describe('dateAtLocalNoonFromTodayOffset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 5, 20, 8, 15, 30)); // 20 Jun 2024 local morning
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('anchors today at local noon when offset is 0', () => {
    const d = dateAtLocalNoonFromTodayOffset(0);
    expect(localYmd(d)).toBe('2024-06-20');
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it('applies positive and negative day offsets from that noon anchor', () => {
    expect(localYmd(dateAtLocalNoonFromTodayOffset(3))).toBe('2024-06-23');
    expect(localYmd(dateAtLocalNoonFromTodayOffset(-2))).toBe('2024-06-18');
  });

  it('rolls across month boundaries from the frozen today', () => {
    expect(localYmd(dateAtLocalNoonFromTodayOffset(15))).toBe('2024-07-05');
  });
});

describe('bookingDateCard', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
      this: Date,
      _locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions
    ) {
      if (options?.month === 'short' && !options.weekday) return 'Jun';
      if (options?.weekday === 'short') return 'Thu';
      return 'fallback';
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds card fields from a valid YMD at local noon', () => {
    const card = bookingDateCard('2024-06-20');
    expect(card).toEqual({
      id: '2024-06-20',
      dayNum: 20,
      monthLabel: 'Jun',
      weekdayLabel: 'Thu',
    });
  });

  it('returns empty labels for malformed or incomplete YMD', () => {
    expect(bookingDateCard('')).toEqual({
      id: '',
      dayNum: 0,
      monthLabel: '',
      weekdayLabel: '',
    });
    expect(bookingDateCard('not-a-date')).toEqual({
      id: 'not-a-date',
      dayNum: 0,
      monthLabel: '',
      weekdayLabel: '',
    });
    expect(bookingDateCard('2024-00-01')).toEqual({
      id: '2024-00-01',
      dayNum: 0,
      monthLabel: '',
      weekdayLabel: '',
    });
    expect(bookingDateCard('2024-01-00')).toEqual({
      id: '2024-01-00',
      dayNum: 0,
      monthLabel: '',
      weekdayLabel: '',
    });
  });
});

describe('formatBookingTimeLabel', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats an ISO timestamp with hour+minute 12h options', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('2:30 PM');
    expect(formatBookingTimeLabel('2024-06-20T14:30:00.000Z')).toBe('2:30 PM');
    expect(spy).toHaveBeenCalledWith(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  });
});

describe('formatBookingDateLong', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a valid YMD with long weekday/month/year options', () => {
    const spy = vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('Thursday, June 20, 2024');
    expect(formatBookingDateLong('2024-06-20')).toBe('Thursday, June 20, 2024');
    expect(spy).toHaveBeenCalledWith(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  });

  it('returns the raw string when YMD cannot be parsed', () => {
    expect(formatBookingDateLong('bad')).toBe('bad');
    expect(formatBookingDateLong('2024-00-10')).toBe('2024-00-10');
  });
});
