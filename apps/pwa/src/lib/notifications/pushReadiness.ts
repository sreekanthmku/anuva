export type PushReadiness = 'ready' | 'ask' | 'blocked' | 'iosInstall' | 'unsupported';

export function isIos(): boolean {
  const nav = window.navigator;
  return (
    /iPad|iPhone|iPod/.test(nav.userAgent) ||
    (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  );
}

export function isAndroid(): boolean {
  return /Android/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Whether notifications can reach this phone now, can be asked for, or need her to act elsewhere. */
export function pushReadiness(): PushReadiness {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    // iPhone only offers push to an app added to the Home Screen.
    return isIos() && !isStandalone() ? 'iosInstall' : 'unsupported';
  }
  if (Notification.permission === 'granted') return 'ready';
  return Notification.permission === 'denied' ? 'blocked' : 'ask';
}
