export function formatLongDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTimeRange(startsAt: string, endsAt: string | null): string {
  const start = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(startsAt));

  if (!endsAt) {
    return start;
  }

  const end = new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(endsAt));

  return `${start} - ${end}`;
}
