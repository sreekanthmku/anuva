import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../src/lib/pwa/platform';
import { resolveVariant } from '../src/features/install/useInstallGate';

const desktopNav = { platform: 'MacIntel', maxTouchPoints: 0 };
const phoneNav = { platform: 'Linux armv8l', maxTouchPoints: 5 };
const iphoneNav = { platform: 'iPhone', maxTouchPoints: 5 };

const UA = {
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  windowsEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0',
  androidWhatsApp:
    'Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 WhatsApp/2.24',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1',
};

describe('detectPlatform', () => {
  it('lets laptops and desktops through, whatever the browser', () => {
    expect(detectPlatform(UA.macChrome, desktopNav)).toBe('desktop');
    expect(detectPlatform(UA.windowsEdge, { platform: 'Win32', maxTouchPoints: 0 })).toBe('desktop');
    expect(detectPlatform(UA.macSafari, desktopNav)).toBe('desktop');
  });

  it('treats an iPad, which reports itself as a Mac, as iOS', () => {
    expect(detectPlatform(UA.macSafari, { platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios-safari');
  });

  it('gives every iPhone browser the Share sheet steps', () => {
    expect(detectPlatform(UA.iphoneSafari, iphoneNav)).toBe('ios-safari');
    expect(detectPlatform(UA.iphoneChrome, iphoneNav)).toBe('ios-safari');
  });

  it('offers the install button on Android Chrome only', () => {
    expect(detectPlatform(UA.androidChrome, phoneNav)).toBe('prompt-capable');
    expect(detectPlatform(UA.androidFirefox, phoneNav)).toBe('unsupported');
  });

  it('spots a link opened inside WhatsApp', () => {
    expect(detectPlatform(UA.androidWhatsApp, phoneNav)).toBe('in-app-browser');
  });
});

describe('resolveVariant', () => {
  const noPrompt = { canPrompt: false, installed: false };

  it('waits for the installed check before choosing a screen', () => {
    expect(resolveVariant({ platform: 'ios-safari', prompt: noPrompt, alreadyInstalled: null })).toBe('checking');
  });

  it('shows the install button only when the browser has offered one', () => {
    expect(
      resolveVariant({ platform: 'prompt-capable', prompt: { canPrompt: true, installed: false }, alreadyInstalled: false }),
    ).toBe('prompt');
    expect(resolveVariant({ platform: 'prompt-capable', prompt: noPrompt, alreadyInstalled: false })).toBe('manual');
  });

  it('points an already-installed doctor at the app, and a just-installed one at the home screen', () => {
    expect(resolveVariant({ platform: 'prompt-capable', prompt: noPrompt, alreadyInstalled: true })).toBe(
      'already-installed',
    );
    expect(
      resolveVariant({ platform: 'prompt-capable', prompt: { canPrompt: false, installed: true }, alreadyInstalled: false }),
    ).toBe('just-installed');
  });

  it('asks a WhatsApp visitor to reopen in a browser before anything else', () => {
    expect(resolveVariant({ platform: 'in-app-browser', prompt: noPrompt, alreadyInstalled: null })).toBe(
      'in-app-browser',
    );
  });
});
