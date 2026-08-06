import { describe, expect, it } from 'vitest';
import { runNudgeSelfTest } from '../src/nudge/selfTest.js';

describe('runNudgeSelfTest', () => {
  it('returns ok:true with expected case totals', () => {
    const result = runNudgeSelfTest();

    // 5 governor + 4 tone + 2 selectL2 = 11
    expect(result.ok).toBe(true);
    expect(result.total).toBe(11);
    expect(result.passed).toBe(11);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(11);
  });

  it('groups cases as governor / tone / selectL2', () => {
    const { results } = runNudgeSelfTest();
    const groups = results.map((r) => r.group);

    expect(groups.filter((g) => g === 'governor')).toHaveLength(5);
    expect(groups.filter((g) => g === 'tone')).toHaveLength(4);
    expect(groups.filter((g) => g === 'selectL2')).toHaveLength(2);
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it('is deterministic across runs', () => {
    const a = runNudgeSelfTest();
    const b = runNudgeSelfTest();
    expect(a).toEqual(b);
  });
});
