import { createContext, useContext } from 'react';
import type { DoctorIdentityResponse } from '@anuva/shared';

export type DoctorIdentityContextValue = DoctorIdentityResponse & {
  signOut: () => void;
};

const DoctorIdentityContext = createContext<DoctorIdentityContextValue | null>(null);

export const DoctorIdentityProvider = DoctorIdentityContext.Provider;

/** Only usable below DoctorKeyGate, which is the only thing that can resolve an identity. */
export function useDoctorIdentity(): DoctorIdentityContextValue {
  const value = useContext(DoctorIdentityContext);
  if (!value) {
    throw new Error('useDoctorIdentity must be used inside DoctorKeyGate.');
  }

  return value;
}
