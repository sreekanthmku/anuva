import { describe, expect, it } from 'vitest';
import {
  addDays,
  dueOccurrences,
  isReminderDay,
  isValidTimeZone,
  localDate,
  nextOccurrence,
  zonedInstant,
  type ReminderSchedule,
} from '../src/medication/schedule.js';

const MINUTE = 60 * 1000;
const GRACE = 15 * MINUTE;

const schedule = (overrides: Partial<ReminderSchedule> = {}): ReminderSchedule => ({
  times: ['08:00', '21:00'],
  days: 'daily',
  weekdays: [],
  timeZone: 'Asia/Kolkata',
  startDate: '2026-10-01',
  scheduleChangedAt: new Date('2026-10-01T00:00:00Z'),
  ...overrides,
});

describe('zoned time', () => {
  it('turns her local time into the right instant', () => {
    // India is UTC+5:30 all year.
    expect(zonedInstant('2026-10-14', '08:00', 'Asia/Kolkata').toISOString()).toBe('2026-10-14T02:30:00.000Z');
    // London is on BST (UTC+1) in October before the 25th, GMT after.
    expect(zonedInstant('2026-10-14', '08:00', 'Europe/London').toISOString()).toBe('2026-10-14T07:00:00.000Z');
    expect(zonedInstant('2026-10-26', '08:00', 'Europe/London').toISOString()).toBe('2026-10-26T08:00:00.000Z');
  });

  it('reads her calendar day in her zone, not the server’s', () => {
    // 20:00 UTC is already the next day in India.
    expect(localDate(new Date('2026-10-14T20:00:00Z'), 'Asia/Kolkata')).toBe('2026-10-15');
    expect(localDate(new Date('2026-10-14T20:00:00Z'), 'America/New_York')).toBe('2026-10-14');
  });

  it('validates zones and adds days across a month end', () => {
    expect(isValidTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31');
  });
});

describe('isReminderDay', () => {
  it('runs every day from the start date, never before it', () => {
    expect(isReminderDay(schedule(), '2026-09-30')).toBe(false);
    expect(isReminderDay(schedule(), '2026-10-01')).toBe(true);
  });

  it('runs on the chosen weekdays only', () => {
    // 2026-10-14 is a Wednesday (3).
    const s = schedule({ days: 'weekdays', weekdays: [1, 3] });
    expect(isReminderDay(s, '2026-10-14')).toBe(true);
    expect(isReminderDay(s, '2026-10-15')).toBe(false);
  });

  it('runs every other day counted from the start date', () => {
    const s = schedule({ days: 'alternate', startDate: '2026-10-14' });
    expect(isReminderDay(s, '2026-10-14')).toBe(true);
    expect(isReminderDay(s, '2026-10-15')).toBe(false);
    expect(isReminderDay(s, '2026-10-16')).toBe(true);
    expect(isReminderDay(s, '2026-11-01')).toBe(true); // 18 days on
  });
});

describe('dueOccurrences', () => {
  const at8 = new Date('2026-10-14T02:30:00Z'); // 08:00 in India

  it('is due at the minute and for the grace after it', () => {
    expect(dueOccurrences(schedule(), at8, GRACE)).toEqual([
      { scheduledFor: at8, date: '2026-10-14', time: '08:00' },
    ]);
    expect(dueOccurrences(schedule(), new Date(at8.getTime() + 14 * MINUTE), GRACE)).toHaveLength(1);
  });

  it('is not due before the time or once the grace has passed', () => {
    expect(dueOccurrences(schedule(), new Date(at8.getTime() - MINUTE), GRACE)).toEqual([]);
    expect(dueOccurrences(schedule(), new Date(at8.getTime() + 15 * MINUTE), GRACE)).toEqual([]);
  });

  it('does not fire a time that was already past when she set it or resumed it', () => {
    const changed = new Date(at8.getTime() + 5 * MINUTE);
    expect(dueOccurrences(schedule({ scheduleChangedAt: changed }), new Date(at8.getTime() + 6 * MINUTE), GRACE)).toEqual(
      [],
    );
  });

  it('catches a late-evening time across her midnight', () => {
    // 23:55 IST on the 14th, checked at 00:05 IST on the 15th.
    const s = schedule({ times: ['23:55'] });
    const now = new Date('2026-10-14T18:35:00Z');
    expect(dueOccurrences(s, now, GRACE)).toEqual([
      { scheduledFor: new Date('2026-10-14T18:25:00Z'), date: '2026-10-14', time: '23:55' },
    ]);
  });

  it('skips a day the reminder does not run', () => {
    const s = schedule({ days: 'weekdays', weekdays: [4] }); // Thursdays; the 14th is a Wednesday
    expect(dueOccurrences(s, at8, GRACE)).toEqual([]);
  });
});

describe('nextOccurrence', () => {
  it('finds the next time the same day, then the next running day', () => {
    const at8 = new Date('2026-10-14T02:30:00Z');
    expect(nextOccurrence(schedule(), at8)?.toISOString()).toBe('2026-10-14T15:30:00.000Z'); // 21:00
    const weekly = schedule({ days: 'weekdays', weekdays: [3], times: ['08:00'] });
    expect(nextOccurrence(weekly, at8)?.toISOString()).toBe('2026-10-21T02:30:00.000Z');
  });
});
