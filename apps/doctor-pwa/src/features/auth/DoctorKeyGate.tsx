import { useState, type FormEvent, type ReactNode } from 'react';
import { getDoctorKey, setDoctorKey } from '../../lib/api';

/**
 * The /doctor API routes are gated behind a shared access key. This collects it once and
 * keeps it in localStorage; apiFetch sends it as x-doctor-key on every request.
 */
export function DoctorKeyGate({ children }: { children: ReactNode }) {
  const [hasKey, setHasKey] = useState(() => Boolean(getDoctorKey()));
  const [value, setValue] = useState('');

  if (hasKey) {
    return <>{children}</>;
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    setDoctorKey(value);
    setHasKey(true);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold text-slate-900">Doctor access</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the access key to view bookings and start consultations.
        </p>

        <input
          type="password"
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          placeholder="Access key"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        <button
          type="submit"
          className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={!value.trim()}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
