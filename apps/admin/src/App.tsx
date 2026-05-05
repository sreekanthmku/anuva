import { useAtom } from 'jotai';
import { useEffect, useState } from 'react';
import { adminTabAtom } from './atoms';
import type { ExampleResponse } from '@anuva/shared';

export default function App() {
  const [tab, setTab] = useAtom(adminTabAtom);
  const [examples, setExamples] = useState<ExampleResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/examples')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ExampleResponse[]>;
      })
      .then(setExamples)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Request failed'));
  }, []);

  return (
    <main className="wrap">
      <h1>Anuva Admin</h1>
      <p className="muted">React + Vite + Jotai</p>
      <nav className="tabs">
        <button type="button" className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>
          Overview
        </button>
        <button type="button" className={tab === 'examples' ? 'active' : ''} onClick={() => setTab('examples')}>
          Examples
        </button>
      </nav>
      {tab === 'overview' && (
        <section className="card">
          <p>Use the Examples tab to inspect API-backed data.</p>
        </section>
      )}
      {tab === 'examples' && (
        <section className="card">
          <h2>Examples</h2>
          {error && <p className="error">{error}</p>}
          {!error && examples === null && <p className="muted">Loading…</p>}
          {!error && examples && examples.length === 0 && <p className="muted">No rows yet.</p>}
          {!error && examples && examples.length > 0 && (
            <ul>
              {examples.map((ex) => (
                <li key={ex.id}>
                  {ex.name} <span className="muted">({ex.createdAt})</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
