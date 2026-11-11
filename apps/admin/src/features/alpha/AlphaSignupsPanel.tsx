import { useCallback, useEffect, useState } from 'react';
import { adminFetch, type AdminApiError } from '../../lib/api';

type CodeCount = { code: string; count: number; configured: boolean };

type AlphaUser = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  alphaCode: string;
  onboardingCompleted: boolean;
  erasedAt: string | null;
  createdAt: string;
};

type Summary = {
  enabled: boolean;
  total: number;
  codes: CodeCount[];
  recent: AlphaUser[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Beta email accounts carry a synthetic `beta:<uuid>` phone; show the email instead. */
function contact(user: AlphaUser): string {
  if (user.erasedAt) return 'Erased';
  if (user.phone.startsWith('beta:')) return user.email ?? '—';
  return user.phone;
}

/** Sign-ups per alpha access code (ALPHA_TESTING_ENABLED / ALPHA_CODES on the API). */
export function AlphaSignupsPanel() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeFilter, setCodeFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await adminFetch<Summary>('/admin/alpha/summary'));
      setError(null);
    } catch (err) {
      setError((err as AdminApiError).message || 'Failed to load alpha sign-ups');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const users = summary?.recent.filter((u) => !codeFilter || u.alphaCode === codeFilter) ?? [];

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Alpha Sign-ups</h2>
          <p className="muted">
            Alpha testing is <strong>{summary ? (summary.enabled ? 'ON' : 'OFF') : '…'}</strong>
            {summary?.enabled
              ? ' — new accounts need one of the codes below.'
              : ' — sign-up is open; no code is asked for or stored.'}{' '}
            Toggle with <code>ALPHA_TESTING_ENABLED</code> on the API, then restart it.
          </p>
        </div>
        <button type="button" className="ghost" onClick={() => void load()}>
          Refresh
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Sign-ups</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {summary?.codes.map((c) => (
              <tr key={c.code}>
                <td>
                  <code>{c.code}</code>
                  {!c.configured && <span className="muted"> (no longer accepted)</span>}
                </td>
                <td>{c.count}</td>
                <td className="row-actions">
                  <button
                    type="button"
                    className="ghost"
                    disabled={c.count === 0}
                    onClick={() => setCodeFilter(codeFilter === c.code ? null : c.code)}
                  >
                    {codeFilter === c.code ? 'Show all' : 'Show users'}
                  </button>
                </td>
              </tr>
            ))}
            {summary && (
              <tr>
                <td>
                  <strong>Total</strong>
                </td>
                <td>
                  <strong>{summary.total}</strong>
                </td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h3>{codeFilter ? `Users who signed up with ${codeFilter}` : 'Latest alpha sign-ups'}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone / email</th>
              <th>Code</th>
              <th>Onboarded</th>
              <th>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No alpha sign-ups yet.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>{u.name ?? <span className="muted">—</span>}</td>
                  <td>{contact(u)}</td>
                  <td>
                    <code>{u.alphaCode}</code>
                  </td>
                  <td>{u.onboardingCompleted ? 'Yes' : 'No'}</td>
                  <td>{formatDate(u.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
