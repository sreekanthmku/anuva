import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getInstallPromptSnapshot, subscribeToInstallPrompt } from '../../lib/pwa/installPrompt';
import { isAppAlreadyInstalled } from '../../lib/pwa/installedApp';
import { getInstallPlatform, type InstallPlatform } from '../../lib/pwa/platform';

export type InstallGateVariant =
  /** Waiting on the already-installed check; one microtask off Chromium. */
  | 'checking'
  /** Installed already, but browsing in a tab: point at the app, no button. */
  | 'already-installed'
  /** WhatsApp/Instagram/Facebook webview: installing is impossible, reopen elsewhere. */
  | 'in-app-browser'
  /** iOS: Share sheet instructions. */
  | 'ios'
  /** A captured prompt is ready. */
  | 'prompt'
  /** Just installed in this page's lifetime: tell them to open the app. */
  | 'just-installed'
  /** Chromium with no prompt available, or a browser we cannot place. */
  | 'manual';

export function useInstallGate(): { variant: InstallGateVariant; platform: InstallPlatform } {
  const platform = useMemo(getInstallPlatform, []);
  const prompt = useSyncExternalStore(subscribeToInstallPrompt, getInstallPromptSnapshot);
  const [alreadyInstalled, setAlreadyInstalled] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isAppAlreadyInstalled().then((installed) => {
      if (active) setAlreadyInstalled(installed);
    });
    return () => {
      active = false;
    };
  }, []);

  return { variant: resolveVariant({ platform, prompt, alreadyInstalled }), platform };
}

export function resolveVariant({
  platform,
  prompt,
  alreadyInstalled,
}: {
  platform: InstallPlatform;
  prompt: { canPrompt: boolean; installed: boolean };
  alreadyInstalled: boolean | null;
}): InstallGateVariant {
  // Installing during this page's life takes priority: the browser cannot launch the app it just
  // created, so the handoff instruction is the only useful screen.
  if (prompt.installed) return 'just-installed';

  // A webview cannot install even if the app is already there, and its "reopen in Safari/Chrome"
  // instruction is more useful than "open the app", so it comes first.
  if (platform === 'in-app-browser') return 'in-app-browser';

  if (alreadyInstalled === null) return 'checking';
  if (alreadyInstalled) return 'already-installed';

  if (platform === 'ios-safari') return 'ios';
  if (platform === 'prompt-capable') return prompt.canPrompt ? 'prompt' : 'manual';
  return 'manual';
}
