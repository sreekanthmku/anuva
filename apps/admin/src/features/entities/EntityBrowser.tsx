import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type { EntityMeta } from '../../atoms';
import { adminFetch, type AdminApiError } from '../../lib/api';

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
  // ISO timestamps → readable local-ish short form
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
  const [draft, setDraft] = useState('{\n  \n}');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showIds, setShowIds] = useState(false);

  const effectiveSort = entity.sortableFields.includes(sort) ? sort : entity.defaultSort;

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
    try {
      const result = await adminFetch<{ data: Record<string, unknown> }>(
        `/admin/entities/${entity.resource}/${id}`,
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
    setDraft('{\n  \n}');
    setActiveId(null);
    setMode('create');
  }

  function openEdit() {
    setMode('edit');
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = JSON.parse(draft) as unknown;
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
      if (err instanceof SyntaxError) setError('Invalid JSON');
      else setError((err as AdminApiError).message || 'Save failed');
    } finally {
      setBusy(false);
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
    return (
      <section className="panel">
        <header className="panel-head">
          <div>
            <button type="button" className="ghost" onClick={() => setMode('list')}>
              ← Back
            </button>
            <h2>
              {mode === 'create' ? 'Create' : mode === 'edit' ? 'Edit' : 'View'} {entity.label}
            </h2>
            {mode === 'view' && (
              <p className="muted">Full record including technical IDs</p>
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
          </div>
        </header>
        {error && <p className="error">{error}</p>}
        <form onSubmit={onSave}>
          <textarea
            className="json-editor"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={mode === 'view'}
            spellCheck={false}
          />
          {mode !== 'view' && (
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          )}
        </form>
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
        <button type="button" onClick={openCreate}>
          Create
        </button>
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
