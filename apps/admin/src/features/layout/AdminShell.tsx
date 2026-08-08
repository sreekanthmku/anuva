import { useAtom } from 'jotai';
import { useEffect, useMemo, useState } from 'react';
import {
  adminTokenAtom,
  entityMetaAtom,
  selectedResourceAtom,
  type EntityMeta,
} from '../../atoms';
import { adminFetch, setStoredToken, type AdminApiError } from '../../lib/api';
import { DoctorAccountsPanel } from '../doctors/DoctorAccountsPanel';
import { EntityBrowser } from '../entities/EntityBrowser';

export function AdminShell() {
  const [token, setToken] = useAtom(adminTokenAtom);
  const [entities, setEntities] = useAtom(entityMetaAtom);
  const [selected, setSelected] = useAtom(selectedResourceAtom);
  const [error, setError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await adminFetch('/admin/auth/me');
        const meta = await adminFetch<{ entities: EntityMeta[] }>('/admin/entities/meta');
        if (cancelled) return;
        setEntities(meta.entities);
        setSelected((prev) => prev ?? meta.entities[0]?.resource ?? null);
        setError(null);
      } catch (err) {
        const apiErr = err as AdminApiError;
        if (apiErr.status === 401) {
          setStoredToken(null);
          setToken(null);
          return;
        }
        if (!cancelled) setError(apiErr.message || 'Failed to load admin meta');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, setEntities, setSelected, setToken]);

  const groups = useMemo(() => {
    const map = new Map<string, EntityMeta[]>();
    for (const e of entities) {
      const list = map.get(e.group) ?? [];
      list.push(e);
      map.set(e.group, list);
    }
    return [...map.entries()];
  }, [entities]);

  const filteredGroups = groupFilter
    ? groups
        .map(([g, items]) => [
          g,
          items.filter(
            (i) =>
              i.label.toLowerCase().includes(groupFilter.toLowerCase()) ||
              i.resource.includes(groupFilter.toLowerCase()),
          ),
        ] as const)
        .filter(([, items]) => items.length > 0)
    : groups;

  function logout() {
    setStoredToken(null);
    setToken(null);
  }

  const current = entities.find((e) => e.resource === selected) ?? null;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <h1>Anuva Admin</h1>
          <button type="button" className="ghost" onClick={logout}>
            Log out
          </button>
        </div>
        <input
          className="nav-filter"
          placeholder="Filter entities…"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
        />
        <nav>
          {filteredGroups.map(([group, items]) => (
            <div key={group} className="nav-group">
              <div className="nav-group-title">{group}</div>
              {items.map((item) => (
                <button
                  key={item.resource}
                  type="button"
                  className={item.resource === selected ? 'nav-item active' : 'nav-item'}
                  onClick={() => setSelected(item.resource)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>
      <main className="content">
        {error && <p className="error">{error}</p>}
        {current?.resource === 'doctor-accounts' ? (
          // Logins get a purpose-built screen; the JSON editor is the wrong tool for a password.
          <DoctorAccountsPanel />
        ) : current ? (
          <EntityBrowser key={current.resource} entity={current} />
        ) : (
          <p className="muted">Select an entity to manage.</p>
        )}
      </main>
    </div>
  );
}
