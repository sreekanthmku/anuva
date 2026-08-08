import { useAtom } from 'jotai';
import { useState, type FormEvent } from 'react';
import { adminTokenAtom } from '../../atoms';
import { adminFetch, setStoredToken, type AdminApiError } from '../../lib/api';

export function LoginForm() {
  const [, setToken] = useAtom(adminTokenAtom);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await adminFetch<{ token: string }>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        token: null,
      });
      setStoredToken(result.token);
      setToken(result.token);
    } catch (err) {
      const apiErr = err as AdminApiError;
      setError(apiErr.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>Anuva Admin</h1>
        <p className="muted">Sign in with the admin password from your environment.</p>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
