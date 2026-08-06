import { describe, expect, it } from 'vitest';
import {
  DAY_TRACKER_ORDER,
  DAY_TRACKERS,
  getNudge,
  NUDGES,
  selectToneTemplate,
  TONE_TEMPLATES,
} from '../src/nudge/registry.js';

const REQUIRED_NUDGE_FIELDS = [
  'id',
  'layer',
  'slot',
  'required',
  'question',
  'options',
  'storage',
] as const;

describe('getNudge', () => {
  it('returns the definition for a known id', () => {
    const def = getNudge('L1-001');
    expect(def).toBeDefined();
    expect(def!.id).toBe('L1-001');
    expect(def!.storage).toEqual({ model: 'sleepLog' });
  });

  it('returns undefined for an unknown id', () => {
    expect(getNudge('L9-999')).toBeUndefined();
    expect(getNudge('')).toBeUndefined();
  });
});

describe('NUDGES integrity', () => {
  const entries = Object.entries(NUDGES);

  it('has unique ids that match Record keys', () => {
    const ids = entries.map(([key, def]) => {
      expect(def.id).toBe(key);
      return def.id;
    });
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every nudge has required fields with sane shapes', () => {
    for (const [key, def] of entries) {
      for (const field of REQUIRED_NUDGE_FIELDS) {
        expect(def[field], `${key}.${field}`).toBeDefined();
      }
      expect([1, 2]).toContain(def.layer);
      expect(['morning', 'afternoon', 'evening']).toContain(def.slot);
      expect(typeof def.required).toBe('boolean');
      expect(def.question.length).toBeGreaterThan(0);
      expect(def.options.length).toBeGreaterThan(0);
      expect(def.storage.model).toBeTruthy();
    }
  });

  it('covers expected L1 and L2 ids', () => {
    expect(Object.keys(NUDGES).sort()).toEqual(
      [
        'L1-001',
        'L1-002',
        'L1-003',
        'L1-004',
        'L1-005',
        'L1-007',
        'L1-008',
        'L2-001',
        'L2-002',
        'L2-003',
        'L2-009',
      ].sort(),
    );
  });
});

describe('DAY_TRACKER_ORDER', () => {
  it('matches Object.keys(DAY_TRACKERS) insertion order', () => {
    expect(DAY_TRACKER_ORDER).toEqual(Object.keys(DAY_TRACKERS));
  });

  it('lists every day-sheet tracker in stable MVP order', () => {
    expect(DAY_TRACKER_ORDER).toEqual([
      'L1-001',
      'L1-002',
      'L1-003',
      'L1-004',
      'L1-005',
      'L2-001',
      'L1-007',
      'L1-008',
      'L2-003',
      'L2-002',
      'L2-009',
    ]);
  });

  it('every ordered id has registry + day-tracker metadata', () => {
    for (const id of DAY_TRACKER_ORDER) {
      expect(getNudge(id), `NUDGES missing ${id}`).toBeDefined();
      expect(DAY_TRACKERS[id], `DAY_TRACKERS missing ${id}`).toBeDefined();
      expect(['core', 'body', 'lifestyle']).toContain(DAY_TRACKERS[id]!.tier);
      expect(DAY_TRACKERS[id]!.label.length).toBeGreaterThan(0);
    }
  });
});

describe('selectToneTemplate', () => {
  it('maps uncertain answers to RT-004', () => {
    expect(selectToneTemplate('L1-003', "I don't know").id).toBe('RT-004');
    expect(selectToneTemplate('L1-005', 'Not sure').id).toBe('RT-004');
    expect(selectToneTemplate('L2-001', 'I forgot to track').id).toBe('RT-004');
  });

  it('maps low-adherence answers to RT-002', () => {
    expect(selectToneTemplate('L1-007', 'I forgot').id).toBe('RT-002');
    expect(selectToneTemplate('L1-007', "I couldn't manage today").id).toBe('RT-002');
    expect(selectToneTemplate('L1-007', 'I did not feel like doing it').id).toBe('RT-002');
  });

  it('maps mood-difficulty answers to RT-003', () => {
    expect(selectToneTemplate('L1-003', 'Sad').id).toBe('RT-003');
    expect(selectToneTemplate('L1-003', 'Anxious').id).toBe('RT-003');
    expect(selectToneTemplate('L1-008', 'I cried or felt emotional').id).toBe('RT-003');
  });

  it('maps positive answers to RT-001', () => {
    expect(selectToneTemplate('L1-001', 'I slept well').id).toBe('RT-001');
    expect(selectToneTemplate('L1-002', 'Fresh and active').id).toBe('RT-001');
    expect(selectToneTemplate('L1-004', 'Low stress').id).toBe('RT-001');
  });

  it('falls back to RT-004 for neutral / unmatched answers', () => {
    expect(selectToneTemplate('L1-001', 'I woke up 1–2 times').id).toBe('RT-004');
    expect(selectToneTemplate('L2-002', 'Sweet cravings').id).toBe('RT-004');
  });

  it('trims and lowercases before matching', () => {
    expect(selectToneTemplate('L1-001', '  I SLEPT WELL  ').id).toBe('RT-001');
    expect(selectToneTemplate('L1-003', '  SAD  ').id).toBe('RT-003');
  });

  it('returns full tone template objects from TONE_TEMPLATES', () => {
    const tone = selectToneTemplate('L1-001', 'I slept well');
    expect(tone).toEqual(TONE_TEMPLATES['RT-001']);
    expect(tone.message.length).toBeGreaterThan(0);
    expect(tone.neverSay.length).toBeGreaterThan(0);
  });
});
