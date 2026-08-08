import { useState, type FormEvent } from 'react';
import { DOCTOR_PASSWORD_MIN } from '@anuva/shared';
import { changeDoctorPassword } from './api';

/**
 * Changing the password signs every other device out server-side, so the sheet says so — a doctor
 * who changes it on a clinic machine should know their phone will ask them to sign in again.
 */
export function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('The two new passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await changeDoctorPassword(currentPassword, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to change the password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-lg text-on-surface">Change password</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border-default px-3 py-1 text-[11px] font-semibold text-on-surface-variant"
          >
            Close
          </button>
        </div>

        {done ? (
          <p className="mt-4 text-sm text-on-surface-variant">
            Password changed. Any other device you were signed in on has been signed out.
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="current-password">
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              autoComplete="current-password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />

            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              autoComplete="new-password"
              minLength={DOCTOR_PASSWORD_MIN}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />
            <p className="mt-1 text-xs text-slate-400">
              At least {DOCTOR_PASSWORD_MIN} characters.
            </p>

            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="confirm-password">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
            />

            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

            <button
              type="submit"
              className="mt-4 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              disabled={
                submitting ||
                !currentPassword ||
                newPassword.length < DOCTOR_PASSWORD_MIN ||
                !confirmPassword
              }
            >
              {submitting ? 'Saving...' : 'Change password'}
            </button>

            <p className="mt-3 text-xs text-slate-400">
              This signs you out everywhere else.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
