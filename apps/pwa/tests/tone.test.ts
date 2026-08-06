import { describe, expect, it } from 'vitest';
import type { LibraryTone } from '@anuva/shared';
import { FRAUNCES, MULISH, TONE_COLOR } from '../src/features/core/library/tone';

const TONES: LibraryTone[] = ['mint', 'butter', 'blush', 'lilac', 'sand'];

describe('TONE_COLOR', () => {
  it('maps every LibraryTone to a hex accent', () => {
    expect(Object.keys(TONE_COLOR).sort()).toEqual([...TONES].sort());
    for (const tone of TONES) {
      expect(TONE_COLOR[tone]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('keeps design-system accents for known tones', () => {
    expect(TONE_COLOR.mint).toBe('#5E3566');
    expect(TONE_COLOR.butter).toBe('#5A4716');
    expect(TONE_COLOR.blush).toBe('#C97E92');
    expect(TONE_COLOR.lilac).toBe('#5B82C4');
    expect(TONE_COLOR.sand).toBe('#B8923C');
  });

  it('uses distinct colors per tone', () => {
    const colors = TONES.map((t) => TONE_COLOR[t]);
    expect(new Set(colors).size).toBe(colors.length);
  });
});

describe('font stacks', () => {
  it('exports Mulish body and Fraunces heading stacks', () => {
    expect(MULISH).toContain('Mulish');
    expect(MULISH).toContain('sans-serif');
    expect(FRAUNCES).toContain('Fraunces');
    expect(FRAUNCES).toContain('sans-serif');
  });
});
