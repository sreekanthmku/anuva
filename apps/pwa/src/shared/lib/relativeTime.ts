/// "Just now" / "3h ago" / "2d ago", then a plain date. Used wherever a card
/// carries the timestamp of the thing that produced it.
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const hours = Math.floor((now - then) / 3_600_000);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
