import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminFetch, type AdminApiError } from '../../lib/api';

type Specialist = {
  id: string;
  key: string;
  name: string;
  portalRole: 'doctor' | 'admin';
  username: string | null;
  active: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string | null;
  lockedUntil: string | null;
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

function suggestUsername(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/^(dr|dr\.)\s+/, '')
      .trim()
      .split(/\s+/)[0]
      ?.replace(/[^a-z0-9._-]/g, '') ?? ''
  );
}

/**
 * Portal logins, one row per specialist. The credential lives on the Specialist row — a specialist
 * is a person, so there is no separate account to keep in step — which is why this screen shows
 * every specialist, including the ones with no login yet.
 *
 * Kept apart from the generic Specialists screen because a password field wants generate-and-show-
 * once handling that a CRUD form should not be doing.
 */
export function SpecialistLoginsPanel() {
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The specialist whose credential is being edited, and the draft for it.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftUsername, setDraftUsername] = useState('');
  const [draftPassword, setDraftPassword] = useState('');

  // The one moment the plaintext exists outside the admin's head. Cleared on the next action.
  const [issued, setIssued] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<ListResponse<Specialist>>(
        '/admin/entities/specialists?pageSize=100&sort=name&order=asc',
      );
      setSpecialists(result.data);
    } catch (err) {
      setError((err as AdminApiError).message || 'Failed to load specialists');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startEdit(specialist: Specialist) {
    setEditingId(specialist.id);
    setDraftUsername(specialist.username ?? suggestUsername(specialist.name));
    setDraftPassword(generatePassword());
    setError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftUsername('');
    setDraftPassword('');
  }

  async function onSave(specialist: Specialist, event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setIssued(null);

    const username = draftUsername.trim().toLowerCase();

    try {
      await adminFetch(`/admin/entities/specialists/${specialist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ username, password: draftPassword }),
      });
      setIssued({ username, password: draftPassword });
      cancelEdit();
      await load();
    } catch (err) {
      setError((err as AdminApiError).message || 'Could not save the login');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveLogin(specialist: Specialist) {
    if (
      !confirm(
        `Remove ${specialist.name}'s portal login? They keep their profile and stay bookable, but can no longer sign in.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Clearing the username is what removes the login; the hash is left orphaned and unusable
      // because nothing can look it up without a username.
      await adminFetch(`/admin/entities/specialists/${specialist.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ username: null }),
      });
      await adminFetch(`/admin/entities/specialists/${specialist.id}/actions/revoke-sessions`, {
        method: 'POST',
      });
      await load();
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
      await adminFetch(`/admin/entities/specialists/${id}/actions/${action}`, { method: 'POST' });
      await load();
    } catch (err) {
      setError((err as AdminApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Specialist Logins</h2>
          <p className="muted">
            Doctor portal sign-in, one per specialist. A <strong>doctor</strong> sees only their own
            consultations; an <strong>admin</strong> row is an ops login that sees every booking and
            never appears in the patient-facing catalog. Profiles are edited under Specialists.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={busy}>
          Refresh
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

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Specialist</th>
              <th>Role</th>
              <th>Username</th>
              <th>Status</th>
              <th>Last sign-in</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {specialists.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {busy ? 'Loading…' : 'No specialists yet.'}
                </td>
              </tr>
            )}
            {specialists.map((specialist) => {
              const locked =
                specialist.lockedUntil !== null &&
                new Date(specialist.lockedUntil).getTime() > Date.now();

              return (
                <tr key={specialist.id}>
                  <td title={specialist.key}>{specialist.name}</td>
                  <td>{specialist.portalRole}</td>
                  <td>{specialist.username ?? <span className="muted">No login</span>}</td>
                  <td>
                    {!specialist.active
                      ? 'Disabled'
                      : locked
                        ? 'Locked out'
                        : specialist.username
                          ? 'Active'
                          : '—'}
                  </td>
                  <td>{formatWhen(specialist.lastLoginAt)}</td>
                  <td className="row-actions">
                    {editingId === specialist.id ? (
                      <form className="inline-reset" onSubmit={(e) => void onSave(specialist, e)}>
                        <input
                          value={draftUsername}
                          autoFocus
                          autoComplete="off"
                          placeholder="Username"
                          onChange={(e) => setDraftUsername(e.target.value)}
                        />
                        <input
                          value={draftPassword}
                          type="text"
                          autoComplete="off"
                          placeholder="Password"
                          onChange={(e) => setDraftPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="ghost"
                          onClick={() => setDraftPassword(generatePassword())}
                        >
                          Generate
                        </button>
                        <button
                          type="submit"
                          disabled={
                            busy ||
                            draftUsername.trim().length < 3 ||
                            draftPassword.length < PASSWORD_MIN
                          }
                        >
                          Save
                        </button>
                        <button type="button" className="ghost" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <>
                        <button type="button" className="ghost" onClick={() => startEdit(specialist)}>
                          {specialist.username ? 'Reset password' : 'Set up login'}
                        </button>
                        {specialist.username && (
                          <>
                            <button
                              type="button"
                              className="ghost"
                              onClick={() => void runAction(specialist.id, 'revoke-sessions')}
                            >
                              Sign out everywhere
                            </button>
                            <button
                              type="button"
                              className="ghost danger"
                              onClick={() => void onRemoveLogin(specialist)}
                            >
                              Remove login
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="ghost"
                          onClick={() =>
                            void runAction(specialist.id, specialist.active ? 'disable' : 'enable')
                          }
                        >
                          {specialist.active ? 'Disable' : 'Enable'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="muted">
        Saving a password signs that specialist out of every device and clears any lockout.
        Disabling takes them out of the booking catalog and blocks sign-in — one switch, one
        meaning.
      </p>
    </section>
  );
}
