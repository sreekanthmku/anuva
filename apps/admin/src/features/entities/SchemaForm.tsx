import type { FormEvent } from 'react';
import type { AdminField } from './fieldTypes';
import { RelationPicker } from './RelationPicker';

type SchemaFormProps = {
  fields: AdminField[];
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onSubmit: (e: FormEvent) => void;
  busy?: boolean;
  readOnly?: boolean;
  submitLabel?: string;
};

function humanEnum(value: string): string {
  return value.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function toDateInputValue(value: unknown, withTime: boolean): string {
  if (value == null || value === '') return '';
  const str = String(value);
  if (withTime) {
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return str.slice(0, 16);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  return str.slice(0, 10);
}

function fromDateInputValue(raw: string, withTime: boolean): string | null {
  if (!raw) return null;
  if (!withTime) return raw;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toISOString();
}

function setField(
  values: Record<string, unknown>,
  name: string,
  value: unknown,
  onChange: (next: Record<string, unknown>) => void,
) {
  onChange({ ...values, [name]: value });
}

export function SchemaForm({
  fields,
  values,
  onChange,
  onSubmit,
  busy,
  readOnly,
  submitLabel = 'Save',
}: SchemaFormProps) {
  return (
    <form className="entity-form" onSubmit={onSubmit}>
      <div className="account-form">
        {fields.map((field) => {
          const raw = values[field.name];
          const id = `field-${field.name}`;

          if (field.type === 'boolean') {
            return (
              <label key={field.name} className="field-checkbox" htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(raw)}
                  disabled={readOnly}
                  onChange={(e) => setField(values, field.name, e.target.checked, onChange)}
                />
              </label>
            );
          }

          if (field.relation) {
            return (
              <label key={field.name} htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <RelationPicker
                  field={field}
                  value={raw == null ? '' : String(raw)}
                  disabled={readOnly}
                  onChange={(next) =>
                    setField(
                      values,
                      field.name,
                      next === '' ? (field.nullable ? null : '') : next,
                      onChange,
                    )
                  }
                />
              </label>
            );
          }

          if (field.type === 'enum' && field.enumValues) {
            return (
              <label key={field.name} htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <select
                  id={id}
                  value={raw == null ? '' : String(raw)}
                  disabled={readOnly}
                  required={field.required && !field.nullable}
                  onChange={(e) => {
                    const next = e.target.value;
                    setField(
                      values,
                      field.name,
                      next === '' ? (field.nullable ? null : '') : next,
                      onChange,
                    );
                  }}
                >
                  <option value="">{field.nullable || !field.required ? '—' : 'Select…'}</option>
                  {field.enumValues.map((v) => (
                    <option key={v} value={v}>
                      {humanEnum(v)}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.type === 'date') {
            const withTime = typeof raw === 'string' && raw.includes('T');
            // Prefer datetime when field name suggests a timestamp
            const useTime =
              withTime ||
              /At$|At\b|scheduled|expires|ends|starts|renews|fired|sent|logged|answered|consented|published/i.test(
                field.name,
              );
            return (
              <label key={field.name} htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <input
                  id={id}
                  type={useTime ? 'datetime-local' : 'date'}
                  value={toDateInputValue(raw, useTime)}
                  disabled={readOnly}
                  required={field.required && !field.nullable}
                  onChange={(e) => {
                    const next = fromDateInputValue(e.target.value, useTime);
                    setField(values, field.name, next, onChange);
                  }}
                />
              </label>
            );
          }

          if (field.type === 'number') {
            return (
              <label key={field.name} htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <input
                  id={id}
                  type="number"
                  value={raw == null || raw === '' ? '' : Number(raw)}
                  disabled={readOnly}
                  required={field.required && !field.nullable}
                  min={field.min}
                  max={field.max}
                  onChange={(e) => {
                    const next = e.target.value;
                    setField(
                      values,
                      field.name,
                      next === '' ? (field.nullable ? null : '') : Number(next),
                      onChange,
                    );
                  }}
                />
              </label>
            );
          }

          if (field.type === 'string[]' || field.type === 'number[]' || field.type === 'json') {
            const display =
              typeof raw === 'string'
                ? raw
                : raw == null
                  ? ''
                  : JSON.stringify(raw, null, field.type === 'json' ? 2 : undefined);
            return (
              <label key={field.name} className="field-wide" htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                  <span className="muted">
                    {field.type === 'string[]' || field.type === 'number[]'
                      ? ' (comma-separated)'
                      : ' (JSON)'}
                  </span>
                </span>
                <textarea
                  id={id}
                  rows={field.type === 'json' ? 4 : 2}
                  value={
                    field.type === 'json'
                      ? display
                      : Array.isArray(raw)
                        ? raw.join(', ')
                        : String(raw ?? '')
                  }
                  disabled={readOnly}
                  required={field.required && !field.nullable}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (field.type === 'json') {
                      setField(values, field.name, text, onChange);
                      return;
                    }
                    const parts = text
                      .split(',')
                      .map((p) => p.trim())
                      .filter(Boolean);
                    setField(
                      values,
                      field.name,
                      field.type === 'number[]' ? parts.map(Number) : parts,
                      onChange,
                    );
                  }}
                />
              </label>
            );
          }

          // string (default)
          if (field.multiline) {
            return (
              <label key={field.name} className="field-wide" htmlFor={id}>
                <span>
                  {field.label}
                  {field.required ? ' *' : ''}
                </span>
                <textarea
                  id={id}
                  rows={4}
                  value={raw == null ? '' : String(raw)}
                  disabled={readOnly}
                  required={field.required && !field.nullable}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  onChange={(e) => {
                    const next = e.target.value;
                    setField(
                      values,
                      field.name,
                      next === '' && field.nullable ? null : next,
                      onChange,
                    );
                  }}
                />
              </label>
            );
          }

          return (
            <label key={field.name} htmlFor={id}>
              <span>
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <input
                id={id}
                type="text"
                value={raw == null ? '' : String(raw)}
                disabled={readOnly}
                required={field.required && !field.nullable}
                minLength={field.minLength}
                maxLength={field.maxLength}
                onChange={(e) => {
                  const next = e.target.value;
                  setField(
                    values,
                    field.name,
                    next === '' && field.nullable ? null : next,
                    onChange,
                  );
                }}
              />
            </label>
          );
        })}
      </div>

      {!readOnly && (
        <div className="account-form-actions">
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      )}
    </form>
  );
}

/** Drop empty strings / undefined so optional fields aren't sent as "". */
export function cleanFormValues(
  values: Record<string, unknown>,
  fields: AdminField[],
): Record<string, unknown> {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    const field = byName.get(key);
    if (!field) continue;

    if (field.type === 'json' && typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        if (field.nullable) out[key] = null;
        continue;
      }
      try {
        out[key] = JSON.parse(trimmed) as unknown;
      } catch {
        out[key] = value;
      }
      continue;
    }

    if (value === '' || value === undefined) {
      if (field.nullable) out[key] = null;
      continue;
    }

    out[key] = value;
  }

  return out;
}
