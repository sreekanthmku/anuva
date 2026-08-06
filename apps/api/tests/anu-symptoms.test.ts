import { describe, it, expect } from 'vitest';
import {
  ANU_SYMPTOMS,
  findSymptom,
  followUpChips,
  logChip,
} from '../src/anu/symptoms.js';

describe('ANU_SYMPTOMS', () => {
  it('contains exactly 40 symptoms', () => {
    expect(ANU_SYMPTOMS).toHaveLength(40);
  });

  it('uses sequential S01–S40 keys', () => {
    expect(ANU_SYMPTOMS.map((s) => s.key)).toEqual(
      Array.from({ length: 40 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
    );
  });

  it('has unique keys and labels', () => {
    const keys = ANU_SYMPTOMS.map((s) => s.key);
    const labels = ANU_SYMPTOMS.map((s) => s.label);
    expect(new Set(keys).size).toBe(40);
    expect(new Set(labels).size).toBe(40);
  });
});

describe('findSymptom', () => {
  it('finds by exact label', () => {
    expect(findSymptom('Hot flashes')).toEqual({
      key: 'S04',
      label: 'Hot flashes',
    });
  });

  it('is case-insensitive', () => {
    expect(findSymptom('HOT FLASHES')).toEqual({
      key: 'S04',
      label: 'Hot flashes',
    });
    expect(findSymptom('brain fog')).toEqual({
      key: 'S12',
      label: 'Brain fog',
    });
  });

  it('trims surrounding whitespace', () => {
    expect(findSymptom('  Mood swings  ')).toEqual({
      key: 'S08',
      label: 'Mood swings',
    });
  });

  it('returns null for unknown labels', () => {
    expect(findSymptom('thyroid disease')).toBeNull();
    expect(findSymptom('Hot flash')).toBeNull();
  });

  it('returns null for null, undefined, and empty string', () => {
    expect(findSymptom(null)).toBeNull();
    expect(findSymptom(undefined)).toBeNull();
    expect(findSymptom('')).toBeNull();
    expect(findSymptom('   ')).toBeNull();
  });
});

describe('followUpChips', () => {
  const hotFlashes = ANU_SYMPTOMS.find((s) => s.key === 'S04')!;

  it('returns up to 3 chips with symptom-specific templates', () => {
    const chips = followUpChips(hotFlashes, []);
    expect(chips).toHaveLength(3);
    expect(chips[0]).toBe('Why does hot flashes happen?');
    expect(chips[1]).toBe('What triggers or worsens hot flashes?');
    expect(chips[2]).toBe('What can I do today?');
  });

  it('skips chips already asked (exact match)', () => {
    const chips = followUpChips(hotFlashes, [
      'Why does hot flashes happen?',
    ]);
    expect(chips).toEqual([
      'What triggers or worsens hot flashes?',
      'What can I do today?',
      'When should I see a doctor?',
    ]);
  });

  it('skips chips already asked (case-insensitive / trimmed)', () => {
    const chips = followUpChips(hotFlashes, [
      '  WHAT CAN I DO TODAY?  ',
      'why does hot flashes happen?',
    ]);
    expect(chips).toEqual([
      'What triggers or worsens hot flashes?',
      'When should I see a doctor?',
    ]);
  });

  it('returns fewer than 3 when most follow-ups were asked', () => {
    const chips = followUpChips(hotFlashes, [
      'Why does hot flashes happen?',
      'What triggers or worsens hot flashes?',
      'What can I do today?',
    ]);
    expect(chips).toEqual(['When should I see a doctor?']);
  });

  it('returns empty when all follow-ups were asked', () => {
    const chips = followUpChips(hotFlashes, [
      'Why does hot flashes happen?',
      'What triggers or worsens hot flashes?',
      'What can I do today?',
      'When should I see a doctor?',
    ]);
    expect(chips).toEqual([]);
  });

  it('uses the symptom label lowercased in templates', () => {
    const spotting = ANU_SYMPTOMS.find((s) => s.key === 'S03')!;
    const chips = followUpChips(spotting, []);
    expect(chips[0]).toBe(
      'Why does spotting or bleeding between periods happen?',
    );
  });
});

describe('logChip', () => {
  it('returns a Log chip with the lowercased label', () => {
    const symptom = ANU_SYMPTOMS.find((s) => s.key === 'S04')!;
    expect(logChip(symptom)).toBe('Log hot flashes');
  });

  it('works for multi-word labels', () => {
    const symptom = ANU_SYMPTOMS.find((s) => s.key === 'S06')!;
    expect(logChip(symptom)).toBe('Log sleep disturbance / insomnia');
  });
});
