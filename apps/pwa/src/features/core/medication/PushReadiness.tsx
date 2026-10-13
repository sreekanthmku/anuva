import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enablePushNotifications } from '../../../lib/firebase';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

type Readiness = 'ready' | 'ask' | 'blocked' | 'iosInstall' | 'unsupported';

function isIos(): boolean {
  const nav = window.navigator;
  return /iPad|iPhone|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function readiness(): Readiness {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    // iPhone only offers push to an app added to the Home Screen.
    return isIos() && !isStandalone() ? 'iosInstall' : 'unsupported';
  }
  if (Notification.permission === 'granted') return 'ready';
  return Notification.permission === 'denied' ? 'blocked' : 'ask';
}

/**
 * Reminders are notifications, so a reminder set up where none can arrive would fail silently. This
 * says so up front — and turns them on when it can.
 */
export function PushReadiness() {
  const { t } = useTranslation();
  const [state, setState] = useState<Readiness>(readiness);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state === 'ready') return null;

  const enable = async () => {
    setBusy(true);
    setError(null);
    try {
      const { permission, sync } = await enablePushNotifications();
      setState(readiness());
      if (permission === 'granted' && !sync.ok) setError(sync.message);
    } catch {
      setError(t('medication.push.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mb-4 rounded-[18px] border border-primary/25 bg-primary/5 px-4 py-3.5 text-[13px] text-on-surface"
      style={{ fontFamily: FONT_BODY }}
    >
      {state === 'ask' && (
        <>
          <p>{t('medication.push.enableHint')}</p>
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy}
            className="mt-2.5 min-h-11 rounded-full bg-secondary px-4 text-[13px] font-semibold text-on-secondary disabled:opacity-60"
          >
            {t('medication.push.enable')}
          </button>
        </>
      )}
      {state === 'blocked' && <p>{t('medication.push.blocked')}</p>}
      {state === 'iosInstall' && <p>{t('medication.push.iosInstall')}</p>}
      {state === 'unsupported' && <p>{t('medication.push.unsupported')}</p>}
      {error && <p className="mt-2 text-[12px] text-error">{error}</p>}
    </div>
  );
}
