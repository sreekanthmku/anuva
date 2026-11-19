import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { isStandalone, subscribeToDisplayMode } from '../../lib/pwa/displayMode';
import { isGateBypassed } from '../../lib/pwa/gateBypass';
import { getInstallPlatform } from '../../lib/pwa/platform';
import InstallGate from './InstallGate';

/**
 * On a phone or tablet, the portal only runs as the installed app; in a phone browser tab it shows
 * the install screen instead. Booking and question alerts are the reason: on iPhone a web page
 * cannot receive push at all until it is added to the home screen, and on Android the installed app
 * is what keeps notifications reliable.
 *
 * Laptops and desktops pass straight through, because doctors take consultations from a computer
 * and the portal works fully in a tab there. `?browser=1` skips the screen on a phone for support.
 *
 * Mounted above the router and the sign-in form, the same as the patient app, so nothing behind it
 * (including sign-in) runs in a phone browser by accident.
 */
export function InstallGuard({ children }: { children: ReactNode }) {
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false);

  // Read once per mount: the bypass stores itself, and re-reading on every render would put a side
  // effect in the render path.
  const [bypassed] = useState(isGateBypassed);
  const [desktop] = useState(() => getInstallPlatform() === 'desktop');

  if (standalone || bypassed || desktop) return <>{children}</>;

  return <InstallGate />;
}
