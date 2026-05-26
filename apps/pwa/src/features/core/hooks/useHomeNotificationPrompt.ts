import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { enablePushNotifications, needsPushRegistrationRetry, syncFcmTokenIfGranted } from '../../../lib/firebase';
import {
  canPromptForNotifications,
  dismissNotificationPrompt,
  syncNotificationPermissionState,
} from '../../../lib/notifications/notificationPrompt';

const PROMPT_DELAY_MS = 1500;

export function useHomeNotificationPrompt() {
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const hasShownDelayedPrompt = useRef(false);

  const runSync = useCallback(async () => {
    const result = await syncFcmTokenIfGranted();
    if (!result) {
      return;
    }

    if (result.ok) {
      setSyncMessage(null);
      return;
    }

    setSyncMessage(result.message);
  }, []);

  const evaluate = useCallback(() => {
    if (status !== 'authenticated') {
      setOpen(false);
      return;
    }

    syncNotificationPermissionState();
    void runSync();

    if (canPromptForNotifications()) {
      if (!hasShownDelayedPrompt.current) {
        hasShownDelayedPrompt.current = true;
        window.setTimeout(() => setOpen(true), PROMPT_DELAY_MS);
      } else {
        setOpen(true);
      }
      return;
    }

    setOpen(false);

    if (needsPushRegistrationRetry()) {
      setSyncMessage((current) => current ?? 'Notifications are on, but this device is not registered yet. Tap retry.');
    }
  }, [status, runSync]);

  useEffect(() => {
    evaluate();

    const onFocus = () => evaluate();
    window.addEventListener('focus', onFocus);

    let permissionStatus: PermissionStatus | null = null;
    void navigator.permissions
      ?.query({ name: 'notifications' as PermissionName })
      .then((result) => {
        permissionStatus = result;
        result.onchange = () => {
          hasShownDelayedPrompt.current = false;
          evaluate();
        };
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener('focus', onFocus);
      if (permissionStatus) {
        permissionStatus.onchange = null;
      }
    };
  }, [evaluate]);

  const accept = async () => {
    setIsRegistering(true);
    try {
      const { permission, sync } = await enablePushNotifications();

      if (permission !== 'granted') {
        setOpen(false);
        if (permission === 'denied') {
          setSyncMessage('Notifications were blocked. Enable them in your browser site settings.');
        }
        return;
      }

      if (!sync?.ok) {
        setOpen(false);
        setSyncMessage(sync?.message ?? 'Could not register this device. Tap retry on Home.');
        return;
      }

      setOpen(false);
      setSyncMessage(null);
    } finally {
      setIsRegistering(false);
    }
  };

  const dismiss = () => {
    dismissNotificationPrompt();
    setOpen(false);
  };

  const retrySync = async () => {
    setIsRetrying(true);
    try {
      await runSync();
    } finally {
      setIsRetrying(false);
    }
  };

  return {
    open,
    accept,
    dismiss,
    syncMessage,
    retrySync,
    isRetrying,
    isRegistering,
    clearSyncMessage: () => setSyncMessage(null),
  };
}
