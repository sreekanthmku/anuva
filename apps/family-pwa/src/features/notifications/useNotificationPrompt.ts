import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
 * Asks on every visit that still has nothing granted, after the screen has settled.
 *
 * The delay is not decoration. A permission dialog thrown up on first paint is the one most people
 * reflexively decline, and the browser gives no second chance — so our own card explaining what the
 * notification is *for* goes first, and only a tap on it triggers the real prompt.
 *
 * "Not now" only quiets it for this sitting; `notificationPrompt.ts` has the reasoning. Here that
 * means re-evaluating on every return to the screen — a remount, the window regaining focus, the
 * app coming back from the background, or the permission itself being reset in site settings.
 */
const PROMPT_DELAY_MS = 2000;

export function useNotificationPrompt(ready: boolean) {
  const { t } = useTranslation();
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
    // A standalone PWA resumed from the background often does not fire `focus`, and that is the
    // single most common way this app is opened.
    const onVisible = () => {
      if (document.visibilityState === 'visible') evaluate();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    // Turning the permission back to "ask" in site settings is a request to be asked again, and it
    // happens outside the app, so nothing else would notice.
    let status: PermissionStatus | null = null;
    void navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        status = result;
        result.onchange = () => {
          scheduled.current = false;
          evaluate();
        };
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      if (status) status.onchange = null;
    };
  }, [evaluate]);

  const accept = useCallback(async () => {
    setRegistering(true);
    setError(null);
    try {
      const { permission, sync } = await enableFamilyNotifications();
      setOpen(false);
      if (permission === 'denied') {
        setError(t('errors.notificationsBlocked'));
        return;
      }
      if (!sync.ok && permission === 'granted') {
        setError(sync.message);
      }
    } finally {
      setRegistering(false);
    }
  }, [t]);

  const dismiss = useCallback(() => {
    dismissPrompt();
    setOpen(false);
  }, []);

  return { open, registering, error, accept, dismiss, clearError: () => setError(null) };
}
