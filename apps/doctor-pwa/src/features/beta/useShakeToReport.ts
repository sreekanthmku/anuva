import { useEffect } from 'react';

/**
 * Shake the phone to report.
 *
 * Worth being clear about what this does and does not cover, because it is easy to assume it is the
 * mechanism when it is really a shortcut:
 *
 *   - **Android Chrome** — works. `devicemotion` needs no permission over HTTPS.
 *   - **iOS** — `DeviceMotionEvent.requestPermission()` must be called from a user gesture, and in
 *     an installed standalone PWA it has a long history of not firing at all. We never prompt for
 *     it: a permission dialog nobody asked for, to enable a gesture nobody knows about, is a bad
 *     trade. iOS testers use the button.
 *
 * So the floating button is the real entry point and this is a nicety on top. Nothing here is the
 * only way in.
 */

/** Total g-force across all axes. Gravity alone is ~9.8, so the threshold is well above resting. */
const SHAKE_THRESHOLD = 25;

/** Two crossings within this window to fire — one jolt is a pocket, two is intent. */
const SHAKE_WINDOW_MS = 900;

/** No second report until this has passed, so one shake cannot open the sheet twice. */
const COOLDOWN_MS = 3000;

export function useShakeToReport(onShake: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
      return;
    }

    let firstJoltAt = 0;
    let lastFiredAt = 0;

    const onMotion = (event: DeviceMotionEvent) => {
      // `accelerationIncludingGravity` rather than `acceleration`: plenty of Android devices report
      // null for the gravity-compensated one.
      const a = event.accelerationIncludingGravity;
      if (!a || a.x === null || a.y === null || a.z === null) return;

      const force = Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z);
      if (force < SHAKE_THRESHOLD) return;

      const now = Date.now();
      if (now - lastFiredAt < COOLDOWN_MS) return;

      if (firstJoltAt && now - firstJoltAt < SHAKE_WINDOW_MS) {
        firstJoltAt = 0;
        lastFiredAt = now;
        onShake();
        return;
      }

      firstJoltAt = now;
    };

    window.addEventListener('devicemotion', onMotion);
    return () => window.removeEventListener('devicemotion', onMotion);
  }, [onShake, enabled]);
}
