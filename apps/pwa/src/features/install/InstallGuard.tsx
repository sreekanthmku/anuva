import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { isStandalone, subscribeToDisplayMode } from '../../lib/pwa/displayMode';
import { isGateBypassed } from '../../lib/pwa/gateBypass';
import { getInstallPlatform } from '../../lib/pwa/platform';
import { trackStandaloneSession } from '../../lib/pwa/installAnalytics';
import InstallGate from './InstallGate';

/**
 * Shows the install gate whenever the app is open in a browser rather than the
 * installed app.
 *
 * Deliberately mounted above the router rather than on the sign-in screen. Most
 * screens redirect an anonymous visitor to sign-in, but the onboarding routes
 * (`/assessment`, `/assessment-paired`, `/assessment-result`, `/subscription`,
 * `/anu-greeting`) are intentionally unprotected — they are where the auth
 * redirects land — so a sign-in-only gate would let someone work through
 * onboarding in a browser. Covering everything here also means new routes are
 * gated by default instead of needing to be remembered.
 *
 * Inside the app this renders nothing of its own, so the existing entry
 * behaviour is untouched: the splash still dispatches returning users to their
 * home screen and new users to sign-in.
 */
export function InstallGuard({ children }: { children: ReactNode }) {
  const standalone = useSyncExternalStore(subscribeToDisplayMode, isStandalone, () => false);

  // Read once per mount: the bypass records its own use, and re-reading it on
  // every render would be a side effect in the render path.
  const [bypassed] = useState(isGateBypassed);

  useEffect(() => {
    if (!standalone) return;
    trackStandaloneSession(getInstallPlatform());
  }, [standalone]);

  if (standalone || bypassed) return <>{children}</>;

  return <InstallGate />;
}
