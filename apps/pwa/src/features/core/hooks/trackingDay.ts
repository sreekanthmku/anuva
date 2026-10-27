/**
 * The day the Track screen is logging for. She may fill in yesterday as well as today — never
 * further back; the API refuses anything older (apps/api/src/trackingDay.ts).
 */
export type TrackingDay = 'today' | 'yesterday';

/** A moment inside yesterday: this time of day, one day back. */
export function yesterdayAt(now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - 1);
  return d;
}

/** Local `YYYY-MM-DD` for a date — the shape joint entries are keyed by. */
export function localYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Whether an ISO timestamp falls on the same local day as `day`. */
export function isSameLocalDay(iso: string, day: Date): boolean {
  return localYmd(new Date(iso)) === localYmd(day);
}

/** The `loggedAt` to send for an entry: none for today (the server stamps it), yesterday's otherwise. */
export function loggedAtFor(day: TrackingDay): { loggedAt?: string } {
  return day === 'yesterday' ? { loggedAt: yesterdayAt().toISOString() } : {};
}
