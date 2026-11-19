/**
 * Which install story applies to this browser.
 *
 * Adapted from the patient app (apps/pwa/src/lib/pwa/platform.ts) with one difference: a doctor
 * on a laptop or desktop is `desktop` and is never asked to install. Consultations are often taken
 * from a computer, and the portal works fully in a browser tab there. Only phones and tablets get
 * the install screen, because that is where push alerts for new bookings need the installed app
 * (on iPhone, a web page cannot receive push at all until it is on the home screen).
 *
 * User-agent sniffing is unreliable by nature, but there is no feature test for "am I inside
 * Instagram's webview". When a phone browser cannot be placed we fall back to `unsupported`, which
 * shows manual instructions rather than a button that might do nothing.
 */

export type InstallPlatform =
  /** Chromium on Android: a real install prompt is possible. */
  | 'prompt-capable'
  /** iOS or iPadOS: no API, Share sheet instructions only. */
  | 'ios-safari'
  /** WhatsApp, Instagram, Facebook and friends: installing is impossible here. */
  | 'in-app-browser'
  /** An Android browser we cannot place: manual instructions. */
  | 'unsupported'
  /** Laptop or desktop: no install screen, the portal runs in the tab. */
  | 'desktop';

/**
 * Embedded webviews. `; wv)` is Android's own WebView marker; the named apps ship custom webviews
 * that do not set it. A doctor is most likely to arrive here from a link sent over WhatsApp.
 */
const IN_APP_BROWSER =
  /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Twitter|TikTok|Snapchat|LinkedInApp|MicroMessenger|Pinterest/i;
const ANDROID_WEBVIEW = /Android.*;\s*wv\)/;

/** Chromium-based, and not one of the forks that cannot install. */
const CHROMIUM = /Chrome\/|Chromium\/|CriOS\/|EdgA?\//;

export function detectIos(userAgent: string, nav: Pick<Navigator, 'platform' | 'maxTouchPoints'>): boolean {
  if (/iPad|iPhone|iPod/.test(userAgent)) return true;
  // iPadOS reports itself as desktop Safari; touch points are the usual tell.
  return nav.platform === 'MacIntel' && nav.maxTouchPoints > 1;
}

export function detectPlatform(
  userAgent: string,
  nav: Pick<Navigator, 'platform' | 'maxTouchPoints'>,
): InstallPlatform {
  if (IN_APP_BROWSER.test(userAgent) || ANDROID_WEBVIEW.test(userAgent)) {
    return 'in-app-browser';
  }

  if (detectIos(userAgent, nav)) {
    // Every iOS browser is WebKit underneath and none of them can install a PWA
    // programmatically, so they all get the Share sheet instructions.
    return 'ios-safari';
  }

  if (/Android/i.test(userAgent)) {
    return CHROMIUM.test(userAgent) ? 'prompt-capable' : 'unsupported';
  }

  return 'desktop';
}

export function getInstallPlatform(): InstallPlatform {
  if (typeof navigator === 'undefined') return 'desktop';
  return detectPlatform(navigator.userAgent, navigator);
}

/**
 * The menu wording differs per app, and a vague "open in your browser" leaves people hunting.
 * Naming the app lets the screen say exactly where to tap.
 */
export function getInAppBrowserName(userAgent = navigator.userAgent): string | null {
  if (/WhatsApp/i.test(userAgent)) return 'WhatsApp';
  if (/Instagram/i.test(userAgent)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/i.test(userAgent)) return 'Facebook';
  if (/LinkedInApp/i.test(userAgent)) return 'LinkedIn';
  if (/Twitter/i.test(userAgent)) return 'X';
  if (/Line\//i.test(userAgent)) return 'LINE';
  return null;
}
