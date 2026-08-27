import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FamilyMeResponse } from '@anuva/shared';
import { ApiError } from '../../shared/lib/api';
import { FamilyAuthContext, type FamilyAuthStatus } from './family-auth-context';
import { fetchFamilyMe, logoutFamily } from './session';

export function FamilyAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<FamilyAuthStatus>('loading');
  const [me, setMe] = useState<FamilyMeResponse | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchFamilyMe();
      setMe(next);
      setStatus('authenticated');
    } catch (error) {
      // 401 is an expired or absent cookie; 403 is access she revoked or sharing she turned off.
      // Both mean the same thing to this app: there is nothing to show.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setMe(null);
        setStatus('anonymous');
        return;
      }
      // A network failure is not proof of being signed out. Stay put rather than bouncing someone
      // to the join screen with no link to hand.
      setStatus((current) => (current === 'loading' ? 'anonymous' : current));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({
      status,
      me,
      setSession: (next: FamilyMeResponse) => {
        setMe(next);
        setStatus('authenticated');
      },
      refresh,
      logout: async () => {
        await logoutFamily();
        setMe(null);
        setStatus('anonymous');
      },
    }),
    [status, me, refresh],
  );

  return <FamilyAuthContext.Provider value={value}>{children}</FamilyAuthContext.Provider>;
}
