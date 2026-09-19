import i18n from '../../i18n';
/// "Just now" / "3h ago" / "2d ago", then a plain date. Used wherever a card
/// carries the timestamp of the thing that produced it.
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const hours = Math.floor((now - then) / 3_600_000);
  if (hours < 1) return i18n.t('time.justNow');
  if (hours < 24) return i18n.t('time.hoursAgo', { count: hours });

  const days = Math.floor(hours / 24);
  if (days < 7) return i18n.t('time.daysAgo', { count: days });

  return new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' });
}
