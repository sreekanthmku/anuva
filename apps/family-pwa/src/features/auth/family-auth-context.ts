import type { FamilyMeResponse } from '@anuva/shared';
import { createContext, useContext } from 'react';

export type FamilyAuthStatus = 'loading' | 'authenticated' | 'anonymous';

export type FamilyAuthContextValue = {
  status: FamilyAuthStatus;
  me: FamilyMeResponse | null;
  setSession: (me: FamilyMeResponse) => void;
  refresh: () => Promise<void>;
  /** Open another woman this phone is connected to (`me.accounts`). */
  switchAccount: (memberId: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const FamilyAuthContext = createContext<FamilyAuthContextValue | null>(null);

export function useFamilyAuth(): FamilyAuthContextValue {
  const context = useContext(FamilyAuthContext);
  if (!context) {
    throw new Error('useFamilyAuth must be used within FamilyAuthProvider.');
  }
  return context;
}
