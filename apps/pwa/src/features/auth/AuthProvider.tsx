import type { AuthSessionResponse } from '@anuva/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../shared/lib/api';
import { setSentryUser } from '../../lib/sentry';
import { markSignedIn, wasSignedIn, wipeDeviceData } from '../../lib/wipeDeviceData';
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
      markSignedIn();
      // Id only. It is what separates "one woman hit this forty times" from "forty women hit it
      // once", which is the difference between a papercut and an outage.
      setSentryUser(currentUser.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        // Signed in here before and refused now: expired, signed out from another device, or her
        // account has been deleted. Whichever, nothing of hers should stay on this device.
        if (wasSignedIn()) await wipeDeviceData();
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
    markSignedIn();
    setSentryUser(session.user.id);
  }

  async function logout() {
    // The server first, while still signed in: it ends the session and drops this device's push.
    await logoutSession().catch(() => undefined);
    // Then the device, so a shared phone keeps nothing of hers (including the Sentry user, so the
    // next person's errors are not attributed to her).
    await wipeDeviceData();
    // A full reload rather than a route change: whatever the app still holds in memory goes too.
    window.location.replace('/login');
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
