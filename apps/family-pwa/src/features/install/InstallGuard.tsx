import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isStandalone, subscribeToDisplayMode } from '../../lib/pwa/displayMode';
import { isGateBypassed } from '../../lib/pwa/gateBypass';
import { getInstallPlatform } from '../../lib/pwa/platform';
import { trackStandaloneSession } from '../../lib/pwa/installAnalytics';
import InstallGate from './InstallGate';

/**
 * Shows the install gate whenever a signed-in member is in a browser tab rather than the installed
 * app.
 *
 * Mounted *inside* the auth boundary, unlike the patient app's guard which sits above the whole
 * router. The difference is how people arrive: she comes to the patient app in her own time, they
 * arrive on a WhatsApp link, and `/join#t=…` carries the invite token in the fragment. Gating that
 * route would be worse than useless — the installed app launches at the manifest's `start_url`, not
 * at the link, so anyone who installed mid-join would lose the token and land on sign-in as a
 * stranger. So `/join` and `/signin` stay open in the browser, and the gate closes the moment there
 * is a session to protect.
 *
 * On Android the installed app shares Chrome's cookies, so they cross this line once. On iPhone the
 * home-screen app has its own jar and the session does not travel; they sign in again with the same
 * phone, which every screen here warns them about.
 */
export function InstallGuard({ children }: { children: ReactNode }) {
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false);

  // Read once per mount: the bypass records its own use, and re-reading it on every render would be
  // a side effect in the render path.
  const [bypassed] = useState(isGateBypassed);

  useEffect(() => {
    if (!standalone) return;
    trackStandaloneSession(getInstallPlatform());
  }, [standalone]);

  if (standalone || bypassed) return <>{children}</>;

  return <InstallGate />;
}
