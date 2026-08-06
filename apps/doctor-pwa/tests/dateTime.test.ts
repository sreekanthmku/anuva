import { describe, expect, it } from 'vitest';
import { formatLongDateTime, formatTimeRange } from '../src/features/bookings/dateTime';

const LONG_OPTS: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
};

const TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: 'numeric',
  minute: '2-digit',
};

describe('formatLongDateTime', () => {
  it('formats an ISO timestamp with en-IN weekday, date, and time', () => {
    const iso = '2024-06-15T14:30:00+05:30';
    expect(formatLongDateTime(iso)).toBe(
      new Intl.DateTimeFormat('en-IN', LONG_OPTS).format(new Date(iso)),
    );
  });

  it('formats a UTC midnight ISO using the same en-IN long options', () => {
    const iso = '2024-01-02T00:00:00.000Z';
    expect(formatLongDateTime(iso)).toBe(
      new Intl.DateTimeFormat('en-IN', LONG_OPTS).format(new Date(iso)),
    );
  });

  it('includes a two-digit minute in the output for a known local-friendly offset', () => {
    // Fixed +05:30 offset avoids host-TZ drift for the minute fragment.
    const result = formatLongDateTime('2024-06-15T09:05:00+05:30');
    expect(result).toMatch(/05/);
  });
});

describe('formatTimeRange', () => {
  it('returns only the start time when endsAt is null', () => {
    const startsAt = '2024-06-15T10:00:00+05:30';
    const expected = new Intl.DateTimeFormat('en-IN', TIME_OPTS).format(new Date(startsAt));
    expect(formatTimeRange(startsAt, null)).toBe(expected);
    expect(formatTimeRange(startsAt, null)).not.toContain(' - ');
  });

  it('joins start and end with a dash when endsAt is provided', () => {
    const startsAt = '2024-06-15T10:00:00+05:30';
    const endsAt = '2024-06-15T10:30:00+05:30';
    const start = new Intl.DateTimeFormat('en-IN', TIME_OPTS).format(new Date(startsAt));
    const end = new Intl.DateTimeFormat('en-IN', TIME_OPTS).format(new Date(endsAt));
    expect(formatTimeRange(startsAt, endsAt)).toBe(`${start} - ${end}`);
  });

  it('formats a multi-hour range across noon', () => {
    const startsAt = '2024-06-15T11:45:00+05:30';
    const endsAt = '2024-06-15T13:15:00+05:30';
    expect(formatTimeRange(startsAt, endsAt)).toBe(
      `${new Intl.DateTimeFormat('en-IN', TIME_OPTS).format(new Date(startsAt))} - ${new Intl.DateTimeFormat('en-IN', TIME_OPTS).format(new Date(endsAt))}`,
    );
  });
});
