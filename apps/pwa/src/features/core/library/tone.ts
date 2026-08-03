import type { LibraryTone } from '@anuva/shared';

/// Accent per tone. The API sends the tone name, never a hex value, so the
/// palette stays in the design layer.
export const TONE_COLOR: Record<LibraryTone, string> = {
  mint: '#5E3566',
  butter: '#5A4716',
  blush: '#C97E92',
  lilac: '#5B82C4',
  sand: '#B8923C',
};

export const MULISH = '"Mulish", -apple-system, system-ui, sans-serif';
export const FRAUNCES = '"Fraunces", sans-serif';
