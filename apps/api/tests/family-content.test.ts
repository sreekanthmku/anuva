/**
 * The two pure functions that decide what a family member reads about her week. Both encode a
 * mistake that is easy to reintroduce, so both are pinned here.
 */

import { describe, expect, it } from 'vitest';

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { arrowFor, metricValue, NOTHING_SHARED } = await import('../src/family/content.js');
const { buildFamilyLearn } = await import('../src/family/digest.js');
const { familyArticle, familyArticleSections, readerFor, FAMILY_ARTICLE_COUNT } = await import(
  '../src/family/articles.js'
);

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

    expect(buildFamilyLearn('partner', week1).nudge.headline).toBe(
      buildFamilyLearn('partner', week1Later).nudge.headline,
    );
    expect(buildFamilyLearn('partner', week1).nudge.headline).not.toBe(
      buildFamilyLearn('partner', week3).nudge.headline,
    );
  });

  it('always serves a nudge and a tip', () => {
    for (let week = 0; week < 8; week += 1) {
      const at = new Date(Date.UTC(2026, 7, 1) + week * 7 * 86_400_000);
      const learn = buildFamilyLearn('partner', at);
      expect(learn.nudge.body.length).toBeGreaterThan(20);
      expect(learn.tip.body.length).toBeGreaterThan(20);
    }
  });

  it('carries the family corpus, not the patient library', () => {
    const slugs = buildFamilyLearn('partner').sections.flatMap((s) => s.articles.map((a) => a.slug));
    expect(slugs).toContain('perimenopause-and-hormones');
    expect(slugs).toContain('share-the-mental-load');
  });
});

/**
 * The audience rules are the reason this corpus is filtered server-side. Both exclusions below are
 * editorial requirements from the source document, and both would be silent if only the client
 * enforced them.
 */
describe('family articles', () => {
  const slugsFor = (relationship: Parameters<typeof familyArticleSections>[0]) =>
    familyArticleSections(relationship).flatMap((s) => s.articles.map((a) => a.slug));

  it('maps relationships onto the three readers', () => {
    expect(readerFor('child')).toBe('teen');
    expect(readerFor('partner')).toBe('partner');
    for (const other of ['parent', 'sibling', 'friend', 'other'] as const) {
      expect(readerFor(other)).toBe('adult');
    }
  });

  it('keeps the intimacy article to adult partners', () => {
    expect(slugsFor('partner')).toContain('closeness-and-intimacy');
    for (const other of ['child', 'parent', 'sibling', 'friend', 'other'] as const) {
      expect(slugsFor(other)).not.toContain('closeness-and-intimacy');
    }
  });

  it('keeps the teen article to teens', () => {
    expect(slugsFor('child')).toContain('supporting-mum-while-being-a-teen');
    for (const other of ['partner', 'parent', 'sibling', 'friend', 'other'] as const) {
      expect(slugsFor(other)).not.toContain('supporting-mum-while-being-a-teen');
    }
  });

  it('serves a hidden slug as missing rather than as content', () => {
    // Guessing the slug must not be a way around the audience rules.
    expect(familyArticle('child', 'closeness-and-intimacy')).toBeNull();
    expect(familyArticle('partner', 'supporting-mum-while-being-a-teen')).toBeNull();
    expect(familyArticle('partner', 'no-such-article')).toBeNull();
  });

  it('shows each reader only their own action', () => {
    const teen = familyArticle('child', 'low-energy-and-fatigue');
    const partner = familyArticle('partner', 'low-energy-and-fatigue');
    expect(teen?.article.action?.text).toMatch(/clearing your dishes/);
    expect(partner?.article.action?.text).toMatch(/planning and preparing dinner/);
    // The explanation itself is common to both — only the ask changes.
    expect(teen?.article.body).toEqual(partner?.article.body);
  });

  it('gives every visible article a body, a saying, a source and the footer', () => {
    for (const relationship of ['partner', 'child', 'friend'] as const) {
      for (const slug of slugsFor(relationship)) {
        const found = familyArticle(relationship, slug);
        expect(found, slug).not.toBeNull();
        const { article } = found!;
        expect(article.body.length, slug).toBeGreaterThan(0);
        expect(article.saying.length, slug).toBeGreaterThan(10);
        expect(article.sources.length, slug).toBeGreaterThan(0);
        expect(article.action, slug).not.toBeNull();
        expect(article.readingMinutes, slug).toBeGreaterThan(0);
        expect(article.footer, slug).toMatch(/not a diagnosis/);
      }
    }
  });

  it('publishes all eighteen topics across the two audiences', () => {
    const all = new Set([...slugsFor('partner'), ...slugsFor('child')]);
    expect(all.size).toBe(FAMILY_ARTICLE_COUNT);
    expect(FAMILY_ARTICLE_COUNT).toBe(18);
  });
});
