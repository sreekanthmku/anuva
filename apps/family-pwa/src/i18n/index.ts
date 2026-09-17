import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_CODES,
  isLanguageCode,
  type LanguageCode,
} from './languages';

/**
 * Where the chosen language lives between visits. Shared spelling with the other Anuva PWAs, so a
 * member who picks Marathi in one app does not get English in the next one on the same device.
 */
export const LANGUAGE_STORAGE_KEY = 'anuva.lang';

/**
 * Every `locales/*.json` is a language, registered by its filename. Adding `mr.json` is the whole
 * of "add Marathi" — no import to remember here, no list to keep in sync. Eager because the bundles
 * are small and a language switch that has to wait on a network request flickers.
 */
const bundles = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json', {
  eager: true,
});

const resources: Record<string, { translation: Record<string, unknown> }> = {};
for (const [path, module] of Object.entries(bundles)) {
  const code = path.replace('./locales/', '').replace('.json', '');
  resources[code] = { translation: module.default };
}

/** Which of the ten actually have a bundle on disk. The toggle greys out the rest. */
export const TRANSLATED_LANGUAGES = LANGUAGE_CODES.filter((code) => code in resources);

function storedLanguage(): LanguageCode | null {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(stored) ? stored : null;
  } catch {
    // Private mode, or storage blocked. Not a reason to fail to render.
    return null;
  }
}

/** The browser's preference, but only when we actually ship that language. */
function browserLanguage(): LanguageCode | null {
  const candidates = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  for (const candidate of candidates) {
    const base = candidate?.split('-')[0]?.toLowerCase();
    if (isLanguageCode(base) && TRANSLATED_LANGUAGES.includes(base)) return base;
  }
  return null;
}

export function initialLanguage(): LanguageCode {
  return storedLanguage() ?? browserLanguage() ?? DEFAULT_LANGUAGE;
}

export function persistLanguage(code: LanguageCode) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
  } catch {
    // See storedLanguage: losing the preference is survivable, throwing here is not.
  }
}

/** Keeps `<html lang>` honest, which is what a screen reader reads the page with. */
export function applyDocumentLanguage(code: string) {
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

const startingLanguage = initialLanguage();

void i18n.use(initReactI18next).init({
  resources,
  lng: startingLanguage,
  // A key the translator has not reached yet renders in English rather than as a raw key.
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGE_CODES,
  // Keys are dotted paths (`home.greeting`), not flat strings with dots in them.
  keySeparator: '.',
  // `:` appears inside copy far more often than it would be useful as a namespace separator.
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

applyDocumentLanguage(startingLanguage);

i18n.on('languageChanged', (code) => {
  applyDocumentLanguage(code);
  if (isLanguageCode(code)) persistLanguage(code);
});

export default i18n;
