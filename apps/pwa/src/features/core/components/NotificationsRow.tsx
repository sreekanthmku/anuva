import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enablePushNotifications } from '../../../lib/firebase';
import { clearNotificationPromptDismissed } from '../../../lib/notifications/notificationPrompt';
import {
  isAndroid,
  isIos,
  pushReadiness,
  type PushReadiness,
} from '../../../lib/notifications/pushReadiness';

const FONT_BODY = '"Mulish", -apple-system, system-ui, sans-serif';

/**
 * One switch for every notification Anuva sends — there is nothing to choose between. Off, a tap
 * asks the phone; blocked, a tap shows where on her phone to turn them back on.
 */
export function NotificationsRow() {
  const { t } = useTranslation();
  const [state, setState] = useState<PushReadiness>(pushReadiness);
  const [busy, setBusy] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // She may come back from her phone's settings with them turned on (or off).
  useEffect(() => {
    const refresh = () => setState(pushReadiness());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const steps = isIos()
    ? t('profile.menu.notifications.stepsIphone')
    : isAndroid()
      ? t('profile.menu.notifications.stepsAndroid')
      : t('profile.menu.notifications.stepsOther');

  const onTap = async () => {
    if (state === 'blocked') {
      setShowSteps((open) => !open);
      return;
    }
    if (state !== 'ask' || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Turning them on here undoes an earlier "Not now" on the Home prompt.
      clearNotificationPromptDismissed();
      const { permission, sync } = await enablePushNotifications();
      setState(pushReadiness());
      if (permission === 'denied') setShowSteps(true);
      if (permission === 'granted' && !sync.ok) setError(sync.message);
    } catch {
      setError(t('profile.menu.notifications.failed'));
    } finally {
      setBusy(false);
    }
  };

  const hint =
    state === 'ready'
      ? t('profile.menu.notifications.on')
      : state === 'ask'
        ? t('profile.menu.notifications.off')
        : state === 'blocked'
          ? t('profile.menu.notifications.blocked')
          : state === 'iosInstall'
            ? t('profile.menu.notifications.iosInstall')
            : t('profile.menu.notifications.unsupported');

  const tappable = state === 'ask' || state === 'blocked';

  return (
    <li>
      <button
        type="button"
        onClick={tappable ? () => void onTap() : undefined}
        aria-expanded={state === 'blocked' ? showSteps : undefined}
        disabled={busy}
        className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors disabled:opacity-60 ${
          tappable ? 'hover:bg-primary-container/60' : 'cursor-default'
        }`}
      >
        <span className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="text-[15px] text-on-surface" style={{ fontFamily: FONT_BODY }}>
            {t('profile.menu.notifications.label')}
          </span>
          <span className="text-[12px] text-on-surface-variant" style={{ fontFamily: FONT_BODY }}>
            {hint}
          </span>
        </span>
        {state === 'ready' && (
          <span
            className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary"
            style={{ fontFamily: FONT_BODY }}
          >
            {t('profile.menu.notifications.onBadge')}
          </span>
        )}
        {state === 'ask' && (
          <span
            className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 text-[12px] font-semibold text-on-secondary"
            style={{ fontFamily: FONT_BODY }}
          >
            {t('profile.menu.notifications.turnOn')}
          </span>
        )}
      </button>
      {state === 'blocked' && showSteps && (
        <p
          className="-mt-1 whitespace-pre-line px-5 pb-4 text-[12px] leading-relaxed text-on-surface"
          style={{ fontFamily: FONT_BODY }}
        >
          {steps}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="-mt-1 px-5 pb-4 text-[12px] text-error"
          style={{ fontFamily: FONT_BODY }}
        >
          {error}
        </p>
      )}
    </li>
  );
}
