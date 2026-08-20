/**
 * Calendar-day keys for `@db.Date` columns.
 *
 * Prisma serialises a JS `Date` for a `@db.Date` column by taking its **UTC**
 * date part. So a local-midnight Date — `new Date(); d.setHours(0,0,0,0)` — is
 * written as the *previous* calendar day everywhere east of UTC: local midnight
 * on 20 Aug in IST is 18:30Z on 19 Aug, and the column stores `2026-08-19`.
 *
 * That is exactly the bug this module exists to prevent. The nudge writers used
 * local midnight and the summary reader used UTC midnight, so an answer given on
 * the 20th was stored on the 19th and the summary's "today" never found it — the
 * tracker showed the metric logged while its gauge sat empty.
 *
 * Two different jobs, two different functions, and the type system cannot tell
 * them apart — so the rule is stated here once:
 *
 *   - `localDayStart` for comparing against **timestamp** columns (`loggedAt`,
 *     `sentAt`, `createdAt`).
 *   - `dayKey` for every value that goes into, or queries, a **`@db.Date`**
 *     column.
 *
 * Never pass a `dayKey` result back through `dayKey`: it is a UTC instant, and
 * west of UTC its local date is the day before.
 */

/** Local midnight. For timestamp comparisons only. */
export function localDayStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

/** UTC midnight of the local calendar day — the only correct `@db.Date` value. */
export function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/** Read a `@db.Date` value back as a local calendar day. */
export function fromDayKey(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** `YYYY-MM-DD` for a local calendar day. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
