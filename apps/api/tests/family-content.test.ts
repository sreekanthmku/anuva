/**
 * The two pure functions that decide what a family member reads about her week. Both encode a
 * mistake that is easy to reintroduce, so both are pinned here.
 */

import { describe, expect, it } from 'vitest';

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { arrowFor, metricValue, NOTHING_SHARED } = await import('../src/family/content.js');
const { buildFamilyLearn } = await import('../src/family/digest.js');

describe('arrowFor', () => {
  it('follows the score on sleep, mood and energy', () => {
    for (const key of ['sleep', 'mood', 'energy'] as const) {
      expect(arrowFor(key, 'positive')).toBe('↑');
      expect(arrowFor(key, 'attention')).toBe('↓');
    }
  });

  it('inverts on stress, because a higher score means less stress', () => {
    // The whole point: an improving stress score must not be drawn as rising stress.
    expect(arrowFor('stress', 'positive')).toBe('↓');
    expect(arrowFor('stress', 'attention')).toBe('↑');
  });

  it('is flat when there is no direction to claim', () => {
    for (const key of ['sleep', 'mood', 'stress', 'energy'] as const) {
      expect(arrowFor(key, 'neutral')).toBe('→');
      expect(arrowFor(key, 'none')).toBe('→');
    }
  });
});

describe('metricValue', () => {
  it('says nothing was shared only when nothing was logged', () => {
    expect(metricValue('sleep', 'none', null)).toBe(NOTHING_SHARED);
  });

  it('falls back to the band when she logged but no direction exists yet', () => {
    // The bug this guards: one logged day has a real reading and no trend. Reporting
    // "Nothing shared yet" there denies that she logged at all.
    expect(metricValue('sleep', 'none', 'Disturbed')).toBe('Disturbed');
    expect(metricValue('stress', 'none', 'Manageable')).toBe('Manageable');
  });

  it('prefers the direction word over the band, as the more actionable of the two', () => {
    expect(metricValue('sleep', 'attention', 'Disturbed')).toBe('Sleeping less');
    expect(metricValue('stress', 'positive', 'Stressful')).toBe('Easing off');
  });

  it('never leaks a number', () => {
    const values = (['positive', 'attention', 'neutral', 'none'] as const).flatMap((tone) =>
      (['sleep', 'mood', 'stress', 'energy'] as const).map((key) => metricValue(key, tone, 'Disturbed')),
    );
    for (const value of values) {
      expect(value).not.toMatch(/\d/);
    }
  });
});

describe('buildFamilyLearn', () => {
  it('is deterministic within a week and rotates across weeks', () => {
    const week1 = new Date('2026-08-27T10:00:00Z');
    const week1Later = new Date('2026-08-29T22:00:00Z');
    const week3 = new Date('2026-09-10T10:00:00Z');

    expect(buildFamilyLearn(week1).nudge.headline).toBe(buildFamilyLearn(week1Later).nudge.headline);
    expect(buildFamilyLearn(week1).nudge.headline).not.toBe(buildFamilyLearn(week3).nudge.headline);
  });

  it('always serves a nudge and a tip', () => {
    for (let week = 0; week < 8; week += 1) {
      const at = new Date(Date.UTC(2026, 7, 1) + week * 7 * 86_400_000);
      const learn = buildFamilyLearn(at);
      expect(learn.nudge.body.length).toBeGreaterThan(20);
      expect(learn.tip.body.length).toBeGreaterThan(20);
    }
  });
});
