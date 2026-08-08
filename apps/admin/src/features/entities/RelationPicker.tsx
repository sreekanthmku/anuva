import { useEffect, useState } from 'react';
import { adminFetch, type AdminApiError } from '../../lib/api';
import type { AdminField } from './fieldTypes';

type RelationPickerProps = {
  field: AdminField;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

function optionLabel(row: Record<string, unknown>, labelFields: string[]): string {
  const parts = labelFields
    .map((f) => row[f])
    .filter((v) => v != null && String(v).trim())
    .map((v) => String(v));
  if (parts.length) return parts.join(' · ');
  return String(row.id ?? 'Unknown');
}

export function RelationPicker({ field, value, disabled, onChange }: RelationPickerProps) {
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const relation = field.relation;

  useEffect(() => {
    if (!relation) return;
    let cancelled = false;
    const resource = relation.resource;
    const labelFields = relation.labelFields;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await adminFetch<{ data: Record<string, unknown>[] }>(
          `/admin/entities/${resource}?pageSize=100&order=asc`,
        );
        if (cancelled) return;
        setOptions(
          result.data.map((row) => ({
            id: String(row.id ?? ''),
            label: optionLabel(row, labelFields),
          })),
        );
      } catch (err) {
        if (!cancelled) setError((err as AdminApiError).message || 'Failed to load options');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [relation]);

  if (!relation) return null;

  return (
    <>
      <select
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        required={field.required && !field.nullable}
      >
        <option value="">{loading ? 'Loading…' : `Select ${field.label.toLowerCase()}…`}</option>
        {value && !options.some((o) => o.id === value) && (
          <option value={value}>Current selection</option>
        )}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </>
  );
}
