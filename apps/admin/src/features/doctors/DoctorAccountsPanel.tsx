import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminFetch, type AdminApiError } from '../../lib/api';

type Specialist = { id: string; key: string; name: string; active: boolean };

type DoctorAccount = {
  id: string;
  username: string;
  role: 'doctor' | 'admin';
  specialistId: string | null;
  /** The list endpoint flattens the relation to a display label, not an object. */
  specialist?: string | null;
  active: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
};

type ListResponse<T> = { data: T[]; meta: { total: number } };

const PASSWORD_MIN = 10;

/**
 * A generated password beats one an admin invents on the spot, and it is shown exactly once —
 * nothing on the server can read it back afterwards.
 */
function generatePassword(): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('');
}

function formatWhen(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Purpose-built screen for doctor portal logins. The generic entity browser can technically do
 * this — it is the same CRUD underneath — but it asks an admin to hand-write JSON and paste a
 * specialist's cuid, which is exactly the kind of step that gets a doctor's account wired to the
 * wrong specialist.
 */
export function DoctorAccountsPanel() {
  const [accounts, setAccounts] = useState<DoctorAccount[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'doctor' | 'admin'>('doctor');
  const [specialistId, setSpecialistId] = useState('');

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');

  // The one moment the plaintext exists outside the admin's head. Cleared on the next action.
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [accountsResult, specialistsResult] = await Promise.all([
        adminFetch<ListResponse<DoctorAccount>>(
          '/admin/entities/doctor-accounts?pageSize=100&sort=username&order=asc',
        ),
        adminFetch<ListResponse<Specialist>>(
          '/admin/entities/specialists?pageSize=100&sort=name&order=asc',
        ),
      ]);
      setAccounts(accountsResult.data);
      setSpecialists(specialistsResult.data);
    } catch (err) {
      setError((err as AdminApiError).message || 'Failed to load doctor accounts');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** A specialist can hold at most one account, so anyone already taken is not offered again. */
  const availableSpecialists = useMemo(() => {
    const taken = new Set(accounts.map((a) => a.specialistId).filter(Boolean));
    return specialists.filter((s) => !taken.has(s.id));
  }, [accounts, specialists]);

  function resetForm() {
    setUsername('');
    setPassword('');
    setRole('doctor');
    setSpecialistId('');
    setCreating(false);
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);

    try {
      await adminFetch('/admin/entities/doctor-accounts', {
        method: 'POST',
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          password,
          role,
          ...(role === 'doctor' ? { specialistId } : {}),
        }),
      });
      setIssued({ username: username.trim().toLowerCase(), password });
      resetForm();
      await load();
    } catch (err) {
      setError((err as AdminApiError).message || 'Could not create the account');
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword(account: DoctorAccount, event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);

    try {
      await adminFetch(`/admin/entities/doctor-accounts/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ password: resetPassword }),
      });
      setIssued({ username: account.username, password: resetPassword });
      setResettingId(null);
      setResetPassword('');
      await load();
    } catch (err) {
      setError((err as AdminApiError).message || 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(id: string, action: string) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/entities/doctor-accounts/${id}/actions/${action}`, {
        method: 'POST',
      });
      await load();
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(account: DoctorAccount) {
    if (!confirm(`Delete the login "${account.username}"? The doctor will not be able to sign in.`))
      return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`/admin/entities/doctor-accounts/${account.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  const canCreate =
    username.trim().length >= 3 &&
    password.length >= PASSWORD_MIN &&
    (role === 'admin' || Boolean(specialistId));

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Doctor Accounts</h2>
          <p className="muted">
            Logins for the doctor portal. A <strong>doctor</strong> account sees only its own
            specialist&apos;s consultations; an <strong>admin</strong> account sees every booking.
          </p>
        </div>
        <button type="button" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : 'New account'}
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      {issued && (
        <div className="issued-password">
          <p>
            Password for <strong>{issued.username}</strong> — copy it now, it cannot be shown again:
          </p>
          <div className="issued-password-row">
            <code>{issued.password}</code>
            <button
              type="button"
              className="ghost"
              onClick={() => void navigator.clipboard?.writeText(issued.password)}
            >
              Copy
            </button>
            <button type="button" className="ghost" onClick={() => setIssued(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {creating && (
        <form className="account-form" onSubmit={onCreate}>
          <label>
            Username
            <input
              value={username}
              autoFocus
              autoComplete="off"
              placeholder="kekin"
              onChange={(e) => setUsername(e.target.value)}
            />
            <span className="muted">
              Letters, numbers, dot, underscore or hyphen. Stored lowercased.
            </span>
          </label>

          <label>
            Role
            <select
              value={role}
              onChange={(e) => {
                const next = e.target.value as 'doctor' | 'admin';
                setRole(next);
                if (next === 'admin') setSpecialistId('');
              }}
            >
              <option value="doctor">Doctor — only their own bookings</option>
              <option value="admin">Admin — every booking</option>
            </select>
          </label>

          {role === 'doctor' && (
            <label>
              Specialist
              <select value={specialistId} onChange={(e) => setSpecialistId(e.target.value)}>
                <option value="">Select a specialist…</option>
                {availableSpecialists.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.key}){s.active ? '' : ' — inactive'}
                  </option>
                ))}
              </select>
              <span className="muted">
                {availableSpecialists.length === 0
                  ? 'Every specialist already has an account.'
                  : 'Specialists that already have a login are not listed.'}
              </span>
            </label>
          )}

          <label>
            Password
            <input
              value={password}
              type="text"
              autoComplete="off"
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="muted">At least {PASSWORD_MIN} characters.</span>
          </label>

          <div className="account-form-actions">
            <button type="button" className="ghost" onClick={() => setPassword(generatePassword())}>
              Generate
            </button>
            <button type="submit" disabled={!canCreate || busy}>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Specialist</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {busy ? 'Loading…' : 'No doctor accounts yet.'}
                </td>
              </tr>
            )}
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.username}</td>
                <td>{account.role}</td>
                <td>
                  {account.role === 'admin' ? '—' : (account.specialist ?? '—')}
                </td>
                <td>{account.active ? 'Active' : 'Disabled'}</td>
                <td>{formatWhen(account.lastLoginAt)}</td>
                <td className="row-actions">
                  {resettingId === account.id ? (
                    <form
                      className="inline-reset"
                      onSubmit={(event) => void onResetPassword(account, event)}
                    >
                      <input
                        value={resetPassword}
                        autoFocus
                        type="text"
                        autoComplete="off"
                        placeholder="New password"
                        onChange={(e) => setResetPassword(e.target.value)}
                      />
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setResetPassword(generatePassword())}
                      >
                        Generate
                      </button>
                      <button type="submit" disabled={resetPassword.length < PASSWORD_MIN || busy}>
                        Save
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setResettingId(null);
                          setResetPassword('');
                        }}
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => {
                          setResettingId(account.id);
                          setResetPassword(generatePassword());
                        }}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void runAction(account.id, account.active ? 'disable' : 'enable')}
                      >
                        {account.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => void runAction(account.id, 'revoke-sessions')}
                      >
                        Sign out everywhere
                      </button>
                      <button
                        type="button"
                        className="ghost danger"
                        onClick={() => void onDelete(account)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Resetting a password signs that doctor out of every device. Disabling the account — or the
        specialist behind it — blocks sign-in immediately.
      </p>
    </section>
  );
}
