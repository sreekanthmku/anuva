// When a medication reminder is due. Pure — no database, no clock of its own — so every rule here
// is unit-testable.
//
// Times are wall-clock times in the reminder's own time zone, captured from her phone: 08:00 means
// 08:00 where she is, whatever zone the server runs in. Turning a local date and time into an
// instant goes through Intl, so a zone with daylight saving is handled without a date library.

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReminderSchedule = {
  times: string[];
  days: string; // daily | weekdays | alternate
  weekdays: number[];
  timeZone: string;
  /// Her local day it was set up (YYYY-MM-DD). Nothing before it is due, and "every other day"
  /// counts from it.
  startDate: string;
  /// Only times at or after this are due, so adding 09:00 at 09:05 — or resuming a paused
  /// reminder at 09:05 — does not fire the 09:00 one late.
  scheduleChangedAt: Date;
};

export type Occurrence = {
  scheduledFor: Date;
  date: string;
  time: string;
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return parts as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/// How far the zone is ahead of UTC at that instant.
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/// Her calendar day at that instant, YYYY-MM-DD.
export function localDate(instant: Date, timeZone: string): string {
  const p = zonedParts(instant, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/// The instant at which it is `time` on `date` in the zone. Two passes, so a time just after a
/// daylight-saving change resolves against the offset in force at that time, not before it.
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  const [hour, minute] = time.split(':').map(Number) as [number, number];
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const first = offsetMs(new Date(wallClock), timeZone);
  let instant = wallClock - first;
  const second = offsetMs(new Date(instant), timeZone);
  if (second !== first) instant = wallClock - second;
  return new Date(instant);
}

function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
}

/// Whether the reminder runs on that local day.
export function isReminderDay(schedule: Pick<ReminderSchedule, 'days' | 'weekdays' | 'startDate'>, date: string): boolean {
  if (date < schedule.startDate) return false;
  switch (schedule.days) {
    case 'daily':
      return true;
    case 'weekdays':
      return schedule.weekdays.includes(new Date(dayNumber(date) * DAY_MS).getUTCDay());
    case 'alternate':
      return (dayNumber(date) - dayNumber(schedule.startDate)) % 2 === 0;
    default:
      return false;
  }
}

function occurrencesOn(schedule: ReminderSchedule, date: string): Occurrence[] {
  if (!isReminderDay(schedule, date)) return [];
  return [...schedule.times]
    .sort()
    .map((time) => ({ scheduledFor: zonedInstant(date, time, schedule.timeZone), date, time }));
}

/// The times that fell due in (now − grace, now]. A reminder later than the grace is skipped rather
/// than sent: one that arrives hours late does more harm than good. Yesterday is included for a
/// window that crosses her midnight.
export function dueOccurrences(schedule: ReminderSchedule, now: Date, graceMs: number): Occurrence[] {
  const today = localDate(now, schedule.timeZone);
  return [addDays(today, -1), today]
    .flatMap((date) => occurrencesOn(schedule, date))
    .filter(
      ({ scheduledFor }) =>
        scheduledFor.getTime() <= now.getTime() &&
        scheduledFor.getTime() > now.getTime() - graceMs &&
        scheduledFor.getTime() >= schedule.scheduleChangedAt.getTime(),
    );
}

/// The first time strictly after `after`, within the next eight days (enough for one weekday a week).
export function nextOccurrence(schedule: ReminderSchedule, after: Date): Date | null {
  const start = localDate(after, schedule.timeZone);
  for (let offset = 0; offset <= 8; offset += 1) {
    const next = occurrencesOn(schedule, addDays(start, offset)).find(
      ({ scheduledFor }) => scheduledFor.getTime() > after.getTime(),
    );
    if (next) return next.scheduledFor;
  }
  return null;
}
