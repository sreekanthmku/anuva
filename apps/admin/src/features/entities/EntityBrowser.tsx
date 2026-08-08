import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { EntityMeta } from '../../atoms';
import { adminFetch, type AdminApiError } from '../../lib/api';
import { cleanFormValues, SchemaForm } from './SchemaForm';

type ListResponse = {
  data: Record<string, unknown>[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    sort: string | null;
    order: 'asc' | 'desc';
  };
};

type Mode = 'list' | 'create' | 'edit' | 'view';

const MAX_COLUMNS = 7;

function isIdLikeField(key: string): boolean {
  return key === 'id' || /Id$/.test(key) || /Hash$/.test(key) || key === 'storagePath';
}

function humanLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function pickColumns(
  row: Record<string, unknown> | undefined,
  listFields: string[] | null | undefined,
  showIds: boolean,
): string[] {
  if (listFields?.length) {
    const cols = listFields.filter((f) => showIds || !isIdLikeField(f));
    if (showIds && !cols.includes('id')) return ['id', ...cols];
    return cols.length ? cols : listFields.slice(0, MAX_COLUMNS);
  }

  if (!row) return showIds ? ['id'] : [];

  const keys = Object.keys(row);
  const preferred = keys.filter((k) => !isIdLikeField(k));
  const ids = keys.filter((k) => isIdLikeField(k));
  const cols = showIds ? [...preferred, ...ids] : preferred;
  return (cols.length ? cols : keys).slice(0, MAX_COLUMNS);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.every((v) => typeof v === 'string' || typeof v === 'number')) {
      return value.join(', ');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  }
  if (str.length > 120) return `${str.slice(0, 117)}…`;
  return str;
}

function emptyFormValues(fields: NonNullable<EntityMeta['createFields']>): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.type === 'boolean') values[field.name] = false;
    else if (field.nullable) values[field.name] = null;
    else values[field.name] = '';
  }
  return values;
}

function recordToFormValues(
  record: Record<string, unknown>,
  fields: NonNullable<EntityMeta['updateFields']>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    values[field.name] = record[field.name] ?? (field.type === 'boolean' ? false : field.nullable ? null : '');
  }
  return values;
}

export function EntityBrowser({ entity }: { entity: EntityMeta }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<ListResponse['meta'] | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(entity.defaultSort);
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>('list');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [viewRecord, setViewRecord] = useState<Record<string, unknown> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showIds, setShowIds] = useState(false);
  const [advancedJson, setAdvancedJson] = useState(false);
  const [draft, setDraft] = useState('{\n  \n}');

  const effectiveSort = entity.sortableFields.includes(sort) ? sort : entity.defaultSort;
  const formFields =
    mode === 'create' ? entity.createFields : mode === 'edit' ? entity.updateFields : null;
  const useForm = Boolean(formFields?.length) && !advancedJson;

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '25',
        sort: effectiveSort,
        order,
      });
      if (q.trim()) params.set('q', q.trim());
      const result = await adminFetch<ListResponse>(
        `/admin/entities/${entity.resource}?${params.toString()}`,
      );
      setRows(result.data);
      setMeta(result.meta);
    } catch (err) {
      setError((err as AdminApiError).message || 'Failed to load');
    } finally {
      setBusy(false);
    }
  }, [entity.resource, page, effectiveSort, order, q]);

  useEffect(() => {
    if (mode === 'list') void load();
  }, [load, mode]);

  async function openView(id: string) {
    setBusy(true);
    setError(null);
    setAdvancedJson(false);
    try {
      const result = await adminFetch<{ data: Record<string, unknown> }>(
        `/admin/entities/${entity.resource}/${id}`,
      );
      setViewRecord(result.data);
      setFormValues(
        entity.updateFields?.length
          ? recordToFormValues(result.data, entity.updateFields)
          : result.data,
      );
      setDraft(JSON.stringify(result.data, null, 2));
      setActiveId(id);
      setMode('view');
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setAdvancedJson(false);
    setActiveId(null);
    setViewRecord(null);
    if (entity.createFields?.length) {
      setFormValues(emptyFormValues(entity.createFields));
      setDraft(JSON.stringify(emptyFormValues(entity.createFields), null, 2));
    } else {
      setFormValues({});
      setDraft('{\n  \n}');
      setAdvancedJson(true);
    }
    setMode('create');
  }

  function openEdit() {
    setAdvancedJson(false);
    setMode('edit');
  }

  async function savePayload(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'create') {
        await adminFetch(`/admin/entities/${entity.resource}`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      } else if (mode === 'edit' && activeId) {
        await adminFetch(`/admin/entities/${entity.resource}/${activeId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      setMode('list');
    } catch (err) {
      setError((err as AdminApiError).message || 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveForm(e: FormEvent) {
    e.preventDefault();
    if (!formFields?.length) return;
    await savePayload(cleanFormValues(formValues, formFields));
  }

  async function onSaveJson(e: FormEvent) {
    e.preventDefault();
    try {
      const body = JSON.parse(draft) as unknown;
      await savePayload(body);
    } catch (err) {
      if (err instanceof SyntaxError) setError('Invalid JSON');
      else setError((err as AdminApiError).message || 'Save failed');
    }
  }

  async function onDelete(id: string) {
    if (!confirm(`Delete this ${entity.label.toLowerCase()}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/entities/${entity.resource}/${id}`, { method: 'DELETE' });
      if (mode !== 'list') setMode('list');
      else await load();
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(id: string, action: string) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch<{ data: Record<string, unknown> }>(
        `/admin/entities/${entity.resource}/${id}/actions/${action}`,
        { method: 'POST' },
      );
      await load();
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo(
    () => pickColumns(rows[0], entity.listFields, showIds),
    [rows, entity.listFields, showIds],
  );

  if (mode !== 'list') {
    const title =
      mode === 'create' ? `Create ${entity.label}` : mode === 'edit' ? `Edit ${entity.label}` : entity.label;

    return (
      <section className="panel">
        <header className="panel-head">
          <div>
            <button type="button" className="ghost" onClick={() => setMode('list')}>
              ← Back
            </button>
            <h2>{title}</h2>
            {mode === 'view' && (
              <p className="muted">Review details. Switch to technical view only if you need IDs.</p>
            )}
          </div>
          <div className="actions">
            {mode === 'view' && (
              <>
                <button type="button" onClick={openEdit}>
                  Edit
                </button>
                {activeId && (
                  <button type="button" className="danger" onClick={() => void onDelete(activeId)}>
                    Delete
                  </button>
                )}
              </>
            )}
            {(mode === 'create' || mode === 'edit') && formFields?.length ? (
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  if (!advancedJson) {
                    setDraft(JSON.stringify(cleanFormValues(formValues, formFields), null, 2));
                  } else {
                    try {
                      const parsed = JSON.parse(draft) as Record<string, unknown>;
                      setFormValues(recordToFormValues(parsed, formFields));
                    } catch {
                      /* keep form values */
                    }
                  }
                  setAdvancedJson((v) => !v);
                }}
              >
                {advancedJson ? 'Simple form' : 'Advanced (JSON)'}
              </button>
            ) : null}
          </div>
        </header>
        {error && <p className="error">{error}</p>}

        {mode === 'view' && !advancedJson && entity.updateFields?.length ? (
          <SchemaForm
            fields={entity.updateFields}
            values={formValues}
            onChange={setFormValues}
            onSubmit={(e) => e.preventDefault()}
            readOnly
          />
        ) : null}

        {mode === 'view' && (!entity.updateFields?.length || advancedJson) && viewRecord ? (
          <dl className="record-view">
            {Object.entries(viewRecord).map(([key, value]) => (
              <div key={key} className="record-row">
                <dt>{humanLabel(key)}</dt>
                <dd title={isIdLikeField(key) ? String(value ?? '') : undefined}>
                  {formatCell(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {mode === 'view' && (
          <button type="button" className="ghost" onClick={() => setAdvancedJson((v) => !v)}>
            {advancedJson || !entity.updateFields?.length ? 'Hide technical JSON' : 'Show technical JSON'}
          </button>
        )}

        {mode === 'view' && (advancedJson || !entity.updateFields?.length) && (
          <textarea className="json-editor" value={draft} readOnly spellCheck={false} />
        )}

        {(mode === 'create' || mode === 'edit') && useForm && formFields ? (
          <SchemaForm
            fields={formFields}
            values={formValues}
            onChange={setFormValues}
            onSubmit={(e) => void onSaveForm(e)}
            busy={busy}
            submitLabel={mode === 'create' ? 'Create' : 'Save changes'}
          />
        ) : null}

        {(mode === 'create' || mode === 'edit') && !useForm ? (
          <form onSubmit={(e) => void onSaveJson(e)}>
            <p className="muted">Technical JSON editor</p>
            <textarea
              className="json-editor"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
            </button>
          </form>
        ) : null}
      </section>
    );
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{entity.label}</h2>
          <p className="muted">{meta ? `${meta.total} total` : ''}</p>
        </div>
        {entity.canCreate !== false && (
          <button type="button" onClick={openCreate}>
            Create
          </button>
        )}
      </header>

      <div className="toolbar">
        <input
          placeholder={
            entity.searchFields.length
              ? `Search ${entity.searchFields.filter((f) => !isIdLikeField(f)).join(', ') || entity.searchFields.join(', ')}…`
              : 'Search…'
          }
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setPage(1);
              void load();
            }
          }}
        />
        <select
          value={effectiveSort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          {entity.sortableFields.map((f) => (
            <option key={f} value={f}>
              Sort: {humanLabel(f)}
            </option>
          ))}
        </select>
        <select value={order} onChange={(e) => setOrder(e.target.value as 'asc' | 'desc')}>
          <option value="desc">Newest first</option>
          <option value="asc">Oldest first</option>
        </select>
        <label className="toggle-ids">
          <input
            type="checkbox"
            checked={showIds}
            onChange={(e) => setShowIds(e.target.checked)}
          />
          Show IDs
        </label>
        <button type="button" onClick={() => void load()} disabled={busy}>
          Refresh
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{humanLabel(c)}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={Math.max(columns.length, 1) + 1} className="muted">
                  {busy ? 'Loading…' : 'No rows'}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const id = String(row.id ?? '');
              return (
                <tr key={id}>
                  {columns.map((c) => (
                    <td key={c} title={isIdLikeField(c) ? String(row[c] ?? '') : undefined}>
                      {formatCell(row[c])}
                    </td>
                  ))}
                  <td className="row-actions">
                    <button type="button" className="ghost" onClick={() => void openView(id)}>
                      View
                    </button>
                    <button type="button" className="ghost danger" onClick={() => void onDelete(id)}>
                      Delete
                    </button>
                    {entity.actions.map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        className="ghost"
                        onClick={() => void runAction(id, a.key)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="pager">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span className="muted">
            Page {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
