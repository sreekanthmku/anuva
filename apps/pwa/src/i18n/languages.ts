/**
 * The ten languages Anuva ships in. Order is deliberate: English first, then the Indian languages
 * by speaker count — a list someone can scan without reading every row.
 *
 * `nativeName` is what the toggle shows. A speaker looking for their language looks for it written
 * the way they write it, not transliterated into Latin.
 */
export type LanguageCode =
  | 'en'
  | 'hi'
  | 'bn'
  | 'mr'
  | 'te'
  | 'ta'
  | 'gu'
  | 'kn'
  | 'ml'
  | 'or';

export type Language = {
  code: LanguageCode;
  /** The language's own name, in its own script. What the toggle renders. */
  nativeName: string;
  /** The English name, for `aria-label` and for anything a screen reader reads in English. */
  englishName: string;
};

export const LANGUAGES: readonly Language[] = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia' },
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as string[]).includes(value);
}

/** English, as the object. Spelled out rather than indexed so it survives strict index checks. */
const ENGLISH: Language = { code: 'en', nativeName: 'English', englishName: 'English' };

export function languageFor(code: string): Language {
  return LANGUAGES.find((language) => language.code === code) ?? ENGLISH;
}
