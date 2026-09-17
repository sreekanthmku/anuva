/**
 * Which install story applies to this browser.
 *
 * User-agent sniffing is unreliable by nature, but there is no feature test for
 * "am I inside Instagram's webview", and getting that case wrong is expensive:
 * an in-app browser cannot install a PWA at all, so showing it an install button
 * leaves the visitor with no way forward. When detection is uncertain we fall
 * back to `unsupported`, which shows manual instructions rather than a button
 * that might do nothing.
 */

export type InstallPlatform =
  /** Chromium on Android or desktop: a real install prompt is possible. */
  | 'prompt-capable'
  /** iOS or iPadOS Safari: no API, Share sheet instructions only. */
  | 'ios-safari'
  /** Instagram, Facebook, and friends: installing is impossible here. */
  | 'in-app-browser'
  /** Firefox, or anything we cannot place: manual instructions. */
  | 'unsupported';

/**
 * Embedded webviews. `; wv)` is Android's own WebView marker; the named apps
 * ship custom webviews that do not set it. FBAN/FBAV/FB_IAB are Facebook and
 * Instagram, which matter most here because paid social is where this traffic
 * comes from.
 */
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|MicroMessenger|Pinterest/i;
const ANDROID_WEBVIEW = /Android.*;\s*wv\)/;

/** Chromium-based, and not one of the forks that cannot install. */
const CHROMIUM = /Chrome\/|Chromium\/|CriOS\/|EdgA?\//;

export function detectIos(userAgent: string, nav: Navigator): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS reports itself as desktop Safari; touch points are the usual tell.
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

export function detectPlatform(userAgent: string, nav: Navigator): InstallPlatform {
  if (IN_APP_BROWSER.test(userAgent) || ANDROID_WEBVIEW.test(userAgent)) {
    return 'in-app-browser';
  }

  if (detectIos(userAgent, nav)) {
    // Every iOS browser is WebKit underneath and none of them can install a
    // PWA programmatically, so they all get the Share sheet instructions.
    return 'ios-safari';
  }

  if (CHROMIUM.test(userAgent)) return 'prompt-capable';

  return 'unsupported';
}

export function getInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'unsupported';
  return detectPlatform(navigator.userAgent, navigator);
}

/**
 * The menu wording differs per app, and a vague "open in your browser" leaves
 * people hunting. Naming the app lets the screen say exactly where to tap.
 */
export function getInAppBrowserName(userAgent = navigator.userAgent): string | null {
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return 'Facebook';
  if (/LinkedInApp/i.test(userAgent)) return 'LinkedIn';
  if (/Twitter/i.test(userAgent)) return 'X';
  if (/TikTok/i.test(userAgent)) return 'TikTok';
  if (/Snapchat/i.test(userAgent)) return 'Snapchat';
  if (/Line\//i.test(userAgent)) return 'LINE';
  if (/MicroMessenger/i.test(userAgent)) return 'WeChat';
  if (/Pinterest/i.test(userAgent)) return 'Pinterest';
  return null;
}
