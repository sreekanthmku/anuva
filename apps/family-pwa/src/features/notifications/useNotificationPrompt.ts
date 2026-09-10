import { useCallback, useEffect, useRef, useState } from 'react';
import {
  enableFamilyNotifications,
  isFirebaseConfigured,
  syncFamilyDeviceIfGranted,
} from '../../lib/firebase';
import {
  canPromptForNotifications,
  dismissPrompt,
  syncPermissionState,
} from '../../lib/notifications/notificationPrompt';

/**
 * Asks once, after the screen has settled.
 *
 * The delay is not decoration. A permission dialog thrown up on first paint is the one most people
 * reflexively decline, and the browser gives no second chance — so our own card explaining what the
 * notification is *for* goes first, and only a tap on it triggers the real prompt.
 */
const PROMPT_DELAY_MS = 2000;

export function useNotificationPrompt(ready: boolean) {
  const [open, setOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scheduled = useRef(false);

  const evaluate = useCallback(() => {
    if (!ready || !isFirebaseConfigured()) return;

    syncPermissionState();
    // Tokens rotate, and a reinstall issues a new one. Re-register whenever they come back.
    void syncFamilyDeviceIfGranted();

    if (!canPromptForNotifications()) {
      setOpen(false);
      return;
    }

    if (scheduled.current) {
      setOpen(true);
      return;
    }
    scheduled.current = true;
    window.setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
  }, [ready]);

  useEffect(() => {
    evaluate();
    const onFocus = () => evaluate();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [evaluate]);

  const accept = useCallback(async () => {
    setRegistering(true);
    setError(null);
    try {
      const { permission, sync } = await enableFamilyNotifications();
      setOpen(false);
      if (permission === 'denied') {
        setError('Notifications are blocked for this site. You can turn them on in site settings.');
        return;
      }
      if (!sync.ok && permission === 'granted') {
        setError(sync.message);
      }
    } finally {
      setRegistering(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    dismissPrompt();
    setOpen(false);
  }, []);

  return { open, registering, error, accept, dismiss, clearError: () => setError(null) };
}
