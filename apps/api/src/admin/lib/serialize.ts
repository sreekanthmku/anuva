/** Strip or transform sensitive / non-JSON-friendly fields before responding. */

const SENSITIVE_KEYS = new Set([
  'tokenHash',
  'accessKeyHash',
  'embedding',
  'providerSessionId',
]);

function serializeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes]`;
  if (Array.isArray(value)) return value.map(serializeValue);
  if (typeof value === 'object') {
    return serializeRecord(value as Record<string, unknown>);
  }
  return value;
}

export function serializeRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_KEYS.has(key)) {
      if (key === 'embedding' && Buffer.isBuffer(value)) {
        out.embedding = `[binary ${value.length} bytes]`;
      } else if (value != null) {
        out[key] = '[redacted]';
      } else {
        out[key] = value;
      }
      continue;
    }
    out[key] = serializeValue(value);
  }
  return out;
}

export function serializeRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.map((row) => serializeRecord(row as Record<string, unknown>));
}
