import { describe, expect, it } from 'vitest';
import { detectIos, detectPlatform, getInAppBrowserName } from '../src/lib/pwa/platform';

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
  desktopChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.0.0 Mobile/15E148 Safari/604.1',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0.0',
  facebookAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0.0.0;]',
  androidWebview:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36',
  firefoxDesktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:127.0) Gecko/20100101 Firefox/127.0',
  ipadOs:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
};

const desktopNav = { platform: 'MacIntel', maxTouchPoints: 0 } as Navigator;
const touchMacNav = { platform: 'MacIntel', maxTouchPoints: 5 } as Navigator;
const androidNav = { platform: 'Linux armv8l', maxTouchPoints: 5 } as Navigator;
const iphoneNav = { platform: 'iPhone', maxTouchPoints: 5 } as Navigator;

describe('detectPlatform', () => {
  it('treats Chromium on Android and desktop as prompt capable', () => {
    expect(detectPlatform(UA.androidChrome, androidNav)).toBe('prompt-capable');
    expect(detectPlatform(UA.desktopChrome, desktopNav)).toBe('prompt-capable');
    expect(detectPlatform(UA.edge, desktopNav)).toBe('prompt-capable');
  });

  it('routes every iOS browser to the Share sheet instructions', () => {
    expect(detectPlatform(UA.iphoneSafari, iphoneNav)).toBe('ios-safari');
    // Chrome on iOS is WebKit underneath and cannot install either, so the
    // Chromium check must not win over the iOS check.
    expect(detectPlatform(UA.iphoneChrome, iphoneNav)).toBe('ios-safari');
  });

  it('detects in-app browsers ahead of the platform they run on', () => {
    expect(detectPlatform(UA.instagramIos, iphoneNav)).toBe('in-app-browser');
    expect(detectPlatform(UA.facebookAndroid, androidNav)).toBe('in-app-browser');
    expect(detectPlatform(UA.androidWebview, androidNav)).toBe('in-app-browser');
  });

  it('falls back to manual instructions for browsers that cannot install', () => {
    expect(detectPlatform(UA.firefoxDesktop, desktopNav)).toBe('unsupported');
  });

  it('recognises iPadOS, which reports itself as desktop Safari', () => {
    expect(detectPlatform(UA.ipadOs, touchMacNav)).toBe('ios-safari');
    // The same UA on a real Mac has no touch points and must not be treated as iOS.
    expect(detectPlatform(UA.ipadOs, desktopNav)).toBe('unsupported');
  });
});

describe('detectIos', () => {
  it('matches iPhone and touch-capable MacIntel only', () => {
    expect(detectIos(UA.iphoneSafari, iphoneNav)).toBe(true);
    expect(detectIos(UA.ipadOs, touchMacNav)).toBe(true);
    expect(detectIos(UA.ipadOs, desktopNav)).toBe(false);
    expect(detectIos(UA.androidChrome, androidNav)).toBe(false);
  });
});

describe('getInAppBrowserName', () => {
  it('names the host app so the instructions can point at its menu', () => {
    expect(getInAppBrowserName(UA.instagramIos)).toBe('Instagram');
    expect(getInAppBrowserName(UA.facebookAndroid)).toBe('Facebook');
  });

  it('returns null when the app is unknown, so copy stays generic', () => {
    expect(getInAppBrowserName(UA.androidWebview)).toBeNull();
    expect(getInAppBrowserName(UA.androidChrome)).toBeNull();
  });
});
