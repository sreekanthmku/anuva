import { describe, expect, it } from 'vitest';
import { decideL2, ROTATION } from '../src/nudge/selectL2Nudge.js';
import { getNudge } from '../src/nudge/registry.js';

describe('ROTATION', () => {
  it('contains Brain fog → Cravings → Food rhythm in MVP order', () => {
    expect([...ROTATION]).toEqual(['L2-003', 'L2-002', 'L2-009']);
  });

  it('has length 3 and unique ids', () => {
    expect(ROTATION).toHaveLength(3);
    expect(new Set(ROTATION).size).toBe(3);
  });

  it('every rotation id exists in the registry as afternoon L2', () => {
    for (const id of ROTATION) {
      const def = getNudge(id);
      expect(def, `missing registry entry for ${id}`).toBeDefined();
      expect(def!.layer).toBe(2);
      expect(def!.slot).toBe('afternoon');
    }
  });
});

describe('decideL2', () => {
  it('always returns rotate:true with null nudgeId (MVP contract)', () => {
    expect(decideL2()).toEqual({
      nudgeId: null,
      setDistress: false,
      rotate: true,
    });
  });

  it('is deterministic across calls', () => {
    expect(decideL2()).toEqual(decideL2());
  });
});
