export const DATES_PER_PAGE = 6;

export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function dateAtLocalNoonFromTodayOffset(firstDayOffset: number): Date {
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + firstDayOffset);
  return anchor;
}

export function bookingDateCard(ymd: string): {
  id: string;
  dayNum: number;
  monthLabel: string;
  weekdayLabel: string;
} {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) {
    return {
      id: ymd,
      dayNum: 0,
      monthLabel: '',
      weekdayLabel: '',
    };
  }
  const date = new Date(y, m - 1, d, 12, 0, 0, 0);
  return {
    id: ymd,
    dayNum: date.getDate(),
    monthLabel: date.toLocaleDateString(undefined, { month: 'short' }),
    weekdayLabel: date.toLocaleDateString(undefined, { weekday: 'short' }),
  };
}

export function formatBookingTimeLabel(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatBookingDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
