import type { AuthSessionResponse } from '@anuva/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../shared/lib/api';
import { setSentryUser } from '../../lib/sentry';
import { AuthContext, type AuthStatus } from './auth-context';
import { fetchCurrentUser, logoutSession } from './session';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthSessionResponse['user'] | null>(null);

  async function refreshUser() {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
      setStatus('authenticated');
      // Id only. It is what separates "one woman hit this forty times" from "forty women hit it
      // once", which is the difference between a papercut and an outage.
      setSentryUser(currentUser.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setStatus('anonymous');
        setSentryUser(null);
        return;
      }

      throw error;
    }
  }

  useEffect(() => {
    refreshUser().catch((error) => {
      console.error(error);
      setUser(null);
      setStatus('anonymous');
    });
  }, []);

  function setAuthenticatedSession(session: AuthSessionResponse) {
    setUser(session.user);
    setStatus('authenticated');
    setSentryUser(session.user.id);
  }

  async function logout() {
    await logoutSession();
    setUser(null);
    setStatus('anonymous');
    // Cleared on the way out, so a shared device does not attribute the next person's errors to
    // the last one.
    setSentryUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        setAuthenticatedSession,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
