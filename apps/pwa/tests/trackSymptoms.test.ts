import { describe, expect, it } from 'vitest';
import { TRACK_DOMAINS } from '../src/features/core/data/trackSymptoms';

describe('TRACK_DOMAINS', () => {
  it('exposes the five Track check-in domains in order', () => {
    expect(TRACK_DOMAINS.map((d) => d.key)).toEqual([
      'vasomotor',
      'physical',
      'cognitive',
      'gsm',
      'skin',
    ]);
    expect(TRACK_DOMAINS.map((d) => d.label)).toEqual([
      'Vasomotor',
      'Physical',
      'Cognitive',
      'Intimate health',
      'Skin & Hair',
    ]);
  });

  it('pairs every item as [id, label] with non-empty strings', () => {
    for (const domain of TRACK_DOMAINS) {
      expect(domain.items.length).toBeGreaterThan(0);
      for (const item of domain.items) {
        expect(item).toHaveLength(2);
        const [id, label] = item;
        expect(id).toMatch(/^[a-z_]+$/);
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps symptom ids unique across all domains', () => {
    const ids = TRACK_DOMAINS.flatMap((d) => d.items.map(([id]) => id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches the known taxonomy counts and sample entries', () => {
    const byKey = Object.fromEntries(TRACK_DOMAINS.map((d) => [d.key, d]));
    expect(byKey.vasomotor.items).toHaveLength(3);
    expect(byKey.physical.items).toHaveLength(8);
    expect(byKey.cognitive.items).toHaveLength(3);
    expect(byKey.gsm.items).toHaveLength(5);
    expect(byKey.skin.items).toHaveLength(4);

    expect(byKey.vasomotor.items).toContainEqual(['hot_flash', 'Hot flash']);
    expect(byKey.cognitive.items).toContainEqual(['brain_fog', 'Brain fog']);
    expect(byKey.gsm.items).toContainEqual(['urinary_leak', 'Leaks']);
    expect(byKey.skin.items).toContainEqual(['thinning_hair', 'Thinning hair']);
  });

  it('is frozen as a const taxonomy (readonly shape)', () => {
    // Structural sanity: domains are plain objects with the expected keys only.
    for (const domain of TRACK_DOMAINS) {
      expect(Object.keys(domain).sort()).toEqual(['items', 'key', 'label']);
    }
  });
});
