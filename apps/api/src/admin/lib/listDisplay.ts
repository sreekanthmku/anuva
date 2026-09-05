/** Flatten Prisma relation includes into human-readable list columns. */

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function formatPerson(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const name = pickString(row.name);
  const phone = pickString(row.phone);
  const email = pickString(row.email);
  if (name && phone) return `${name} · ${phone}`;
  return name ?? phone ?? email;
}

function formatLabeled(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  return (
    pickString(row.label, row.name, row.title, row.key, row.prompt, row.topic, row.slug) ??
    null
  );
}

function formatQuestion(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const topic = pickString(row.topic);
  const prompt = pickString(row.prompt);
  const body = pickString(row.body);
  const key = pickString(row.key);
  if (topic && body) return `${topic}: ${body.slice(0, 80)}${body.length > 80 ? '…' : ''}`;
  if (prompt) return key ? `${key} · ${prompt}` : prompt;
  return topic ?? body ?? key;
}

function formatLog(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : pickString(row.date);
  const user = formatPerson(asRecord(row.user));
  if (date && user) return `${date} · ${user}`;
  return date ?? user;
}

function formatReport(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const start =
    row.weekStart instanceof Date
      ? row.weekStart.toISOString().slice(0, 10)
      : pickString(row.weekStart);
  const user = formatPerson(asRecord(row.user));
  if (start && user) return `${start} · ${user}`;
  return start ?? user;
}

function formatThread(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const user = formatPerson(asRecord(row.user));
  const created =
    row.createdAt instanceof Date
      ? row.createdAt.toISOString().slice(0, 10)
      : pickString(row.createdAt);
  if (user && created) return `${user} · ${created}`;
  return user ?? created;
}

function formatConsultation(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  const when =
    row.scheduledAt instanceof Date
      ? row.scheduledAt.toISOString()
      : pickString(row.scheduledAt);
  const user = formatPerson(asRecord(row.user));
  const specialist = formatLabeled(asRecord(row.specialist));
  const parts = [user, specialist, when].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

const RELATION_FORMATTERS: Record<
  string,
  (row: Record<string, unknown> | null) => string | null
> = {
  user: formatPerson,
  specialist: formatLabeled,
  uploadedBy: formatLabeled,
  symptom: formatLabeled,
  carePath: formatLabeled,
  question: formatQuestion,
  log: formatLog,
  report: formatReport,
  thread: formatThread,
  consultation: formatConsultation,
  assessment: (row) => {
    if (!row) return null;
    const user = formatPerson(asRecord(row.user));
    const score = typeof row.score === 'number' ? `score ${row.score}` : null;
    const status = pickString(row.status);
    return [user, score, status].filter(Boolean).join(' · ') || null;
  },
};

/**
 * Turn nested Prisma includes into flat string labels — so list tables show people and titles
 * rather than cuids. The raw FK columns are kept: a client that has to act on a row (link it,
 * match it against another list) needs the id, and hiding it is a display decision the table
 * already makes via `listFields` and its Show IDs toggle.
 */
export function flattenListRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };

  for (const [key, formatter] of Object.entries(RELATION_FORMATTERS)) {
    const nested = asRecord(out[key]);
    if (!nested) continue;
    const label = formatter(nested);
    if (label != null) out[key] = label;
    else delete out[key];
  }

  // Drop any remaining nested objects (avoid dumping JSON blobs in the table)
  for (const [key, value] of Object.entries(out)) {
    if (asRecord(value)) delete out[key];
  }

  return out;
}

export function flattenListRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(flattenListRow);
}
