import type { AuthSessionResponse } from '@anuva/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../shared/lib/api';
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
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setUser(null);
        setStatus('anonymous');
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
  }

  async function logout() {
    await logoutSession();
    setUser(null);
    setStatus('anonymous');
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
