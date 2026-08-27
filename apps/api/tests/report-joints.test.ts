import { describe, it, expect } from 'vitest';
import { jointDiscomfortScore } from '@anuva/shared';
import { buildJointsSummary, type JointRow } from '../src/report/joints.js';

function day(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function row(dateStr: string, over: Partial<JointRow> = {}): JointRow {
  const severity = over.severity ?? 'moderate';
  const impact = over.impact ?? 'a_little';
  return {
    date: day(dateStr),
    severity,
    areas: over.areas ?? ['knees'],
    symptoms: over.symptoms ?? ['stiffness'],
    impact: severity === 'none' ? null : impact,
    score: over.score ?? 50,
  };
}

/** A Mon-Sun week, with the previous week as the comparison window. */
const WEEK = {
  coverageStart: day('2026-08-17'),
  coverageEnd: day('2026-08-23'),
  seriesStart: day('2026-08-17'),
  seriesEnd: day('2026-08-23'),
  prevStart: day('2026-08-10'),
  prevEnd: day('2026-08-16'),
  daysInWindow: 7,
};

describe('jointDiscomfortScore', () => {
  it('is 0 for no discomfort', () => {
    expect(jointDiscomfortScore('none', null)).toBe(0);
  });

  it('is 100 only when severity and impact are both at their worst', () => {
    expect(jointDiscomfortScore('severe', 'a_lot')).toBe(100);
  });

  it('weights severity at 70% and impact at 30%', () => {
    // Severe (3/3) with no impact = 70; not-at-all impact contributes nothing.
    expect(jointDiscomfortScore('severe', 'not_at_all')).toBe(70);
    // Mild (1/3 → 23.33) + moderately (2/3 → 20) = 43.
    expect(jointDiscomfortScore('mild', 'moderately')).toBe(43);
  });

  it('treats a missing impact as none rather than as unknown', () => {
    expect(jointDiscomfortScore('moderate', null)).toBe(jointDiscomfortScore('moderate', 'not_at_all'));
  });
});

describe('buildJointsSummary', () => {
  it('is null when the tracker was never logged in the window', () => {
    expect(buildJointsSummary([], WEEK)).toBeNull();
    // A row exists, but in the previous week — the window itself is empty.
    expect(buildJointsSummary([row('2026-08-12')], WEEK)).toBeNull();
  });

  it('names the mean severity rather than reporting a decimal', () => {
    const summary = buildJointsSummary(
      [row('2026-08-17', { severity: 'mild' }), row('2026-08-18', { severity: 'moderate' })],
      WEEK,
    );
    // Mean 1.5 sits on the Moderate boundary.
    expect(summary?.averageDiscomfort).toBe('Moderate');
  });

  it('counts discomfort days separately from logged days', () => {
    const summary = buildJointsSummary(
      [
        row('2026-08-17', { severity: 'none' }),
        row('2026-08-18', { severity: 'mild' }),
        row('2026-08-19', { severity: 'moderate' }),
      ],
      WEEK,
    );
    expect(summary?.daysLogged).toBe(3);
    expect(summary?.daysWithDiscomfort).toBe(2);
    expect(summary?.daysInWindow).toBe(7);
  });

  it('reports the most affected area and most common symptom in plain words', () => {
    const summary = buildJointsSummary(
      [
        row('2026-08-17', { areas: ['knees'], symptoms: ['stiffness'] }),
        row('2026-08-18', { areas: ['knees', 'hips'], symptoms: ['stiffness', 'aching'] }),
        row('2026-08-19', { areas: ['hips'], symptoms: ['aching'] }),
      ],
      WEEK,
    );
    // Knees and hips tie at 2; the declared option order breaks it, and either
    // way the label is prose, never an enum value.
    expect(summary?.mostAffectedArea).toBe('Hips');
    expect(summary?.mostCommonSymptom).toBe('Aching');
  });

  it('ignores areas and symptoms from days with no discomfort', () => {
    const summary = buildJointsSummary(
      [row('2026-08-17', { severity: 'none', areas: ['knees'], symptoms: ['pain'] })],
      WEEK,
    );
    expect(summary?.mostAffectedArea).toBeNull();
    expect(summary?.mostCommonSymptom).toBeNull();
    expect(summary?.impact).toBeNull();
  });

  it('has no direction without a previous window to compare against', () => {
    expect(buildJointsSummary([row('2026-08-17')], WEEK)?.direction).toBeNull();
  });

  it('calls a real drop improving and a real rise worsening', () => {
    const improving = buildJointsSummary(
      [row('2026-08-17', { severity: 'mild' }), row('2026-08-12', { severity: 'severe' })],
      WEEK,
    );
    expect(improving?.direction).toBe('improving');

    const worsening = buildJointsSummary(
      [row('2026-08-17', { severity: 'severe' }), row('2026-08-12', { severity: 'mild' })],
      WEEK,
    );
    expect(worsening?.direction).toBe('worsening');
  });

  it('calls a change smaller than a quarter-step steady', () => {
    const summary = buildJointsSummary(
      [
        row('2026-08-17', { severity: 'moderate' }),
        row('2026-08-18', { severity: 'moderate' }),
        row('2026-08-19', { severity: 'mild' }),
        // Previous week: two moderate, one mild → same mean.
        row('2026-08-11', { severity: 'moderate' }),
        row('2026-08-12', { severity: 'moderate' }),
        row('2026-08-13', { severity: 'mild' }),
      ],
      WEEK,
    );
    expect(summary?.direction).toBe('steady');
  });

  it('describes impact in plain language', () => {
    const summary = buildJointsSummary(
      [
        row('2026-08-17', { impact: 'a_little' }),
        row('2026-08-18', { impact: 'a_little' }),
        row('2026-08-19', { impact: 'moderately' }),
      ],
      WEEK,
    );
    expect(summary?.impact).toBe('Mostly mild');
  });

  it('lays the trend out one entry per day, null where nothing was logged', () => {
    const summary = buildJointsSummary(
      [row('2026-08-17', { score: 40 }), row('2026-08-20', { score: 70 })],
      WEEK,
    );
    expect(summary?.trend).toEqual([40, null, null, 70, null, null, null]);
  });
});
