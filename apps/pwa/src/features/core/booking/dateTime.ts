export const DATES_PER_PAGE = 6;

export function localYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 30-minute slots from 10:00 to 16:30 (last slot ends at 17:00). */
export function consultationTimeSlots(): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const startMin = 10 * 60;
  const endMin = 17 * 60;
  for (let t = startMin; t + 30 <= endMin; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const id = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const d = new Date(2000, 0, 1, h, m);
    const label = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
    out.push({ id, label });
  }
  return out;
}

export function dateSlotsFromTodayOffset(
  firstDayOffset: number,
  count: number,
): { id: string; dayNum: number; monthLabel: string; weekdayLabel: string }[] {
  const out: { id: string; dayNum: number; monthLabel: string; weekdayLabel: string }[] = [];
  const anchor = new Date();
  anchor.setHours(12, 0, 0, 0);
  anchor.setDate(anchor.getDate() + firstDayOffset);
  for (let i = 0; i < count; i++) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() + i);
    out.push({
      id: localYmd(d),
      dayNum: d.getDate(),
      monthLabel: d.toLocaleDateString(undefined, { month: 'short' }),
      weekdayLabel: d.toLocaleDateString(undefined, { weekday: 'short' }),
    });
  }
  return out;
}

export function formatBookingDateLong(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
