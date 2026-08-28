import { describe, expect, it } from 'vitest';
import { getDailyInsight, getLibraryArticle, getLibraryFeed } from '../src/library.js';

describe('getLibraryFeed', () => {
  it('returns featured article as feature on unfiltered feed and excludes it from articles', () => {
    const feed = getLibraryFeed({});

    expect(feed.feature).not.toBeNull();
    expect(feed.feature?.featured).toBe(true);
    expect(feed.feature?.slug).toBe('hot-flashes-and-your-sleep');
    // No masterclass is scheduled yet; the card is hidden while this is null.
    expect(feed.session).toBeNull();
    expect(feed.categories.length).toBeGreaterThan(0);

    const featuredInList = feed.articles.find((a) => a.slug === feed.feature!.slug);
    expect(featuredInList).toBeUndefined();

    // Summaries never carry body blocks.
    for (const article of feed.articles) {
      expect(article).not.toHaveProperty('blocks');
      expect(article).not.toHaveProperty('tags');
    }
    expect(feed.feature).not.toHaveProperty('blocks');
  });

  it('filters by category and keeps featured piece in the list (feature is null)', () => {
    const feed = getLibraryFeed({ category: 'sleep' });

    expect(feed.feature).toBeNull();
    expect(feed.articles.length).toBeGreaterThan(0);
    expect(feed.articles.every((a) => a.category === 'sleep')).toBe(true);

    const featured = feed.articles.find((a) => a.slug === 'hot-flashes-and-your-sleep');
    expect(featured).toBeDefined();
    expect(featured?.featured).toBe(true);
  });

  it('filters by search across title, dek, and tags (case-insensitive)', () => {
    const byTitle = getLibraryFeed({ search: 'brain fog' });
    expect(byTitle.feature).toBeNull();
    expect(byTitle.articles.some((a) => a.slug === 'brain-fog-lower-fuel')).toBe(true);
    expect(byTitle.articles.every((a) => {
      const hay = `${a.title} ${a.dek}`.toLowerCase();
      // Tag matches are not on the summary; assert at least one known hit.
      return hay.includes('brain') || a.slug.includes('brain');
    })).toBe(true);

    const byTag = getLibraryFeed({ search: 'bone health' });
    expect(byTag.feature).toBeNull();
    expect(byTag.articles.some((a) => a.slug === 'bone-health-perimenopause')).toBe(true);

    const byDek = getLibraryFeed({ search: 'checklist' });
    expect(byDek.articles.some((a) => a.slug === 'sleep-hygiene-isnt-enough')).toBe(true);

    const empty = getLibraryFeed({ search: 'zzzz-no-such-term' });
    expect(empty.feature).toBeNull();
    expect(empty.articles).toEqual([]);
  });

  it('applies category and search together', () => {
    const feed = getLibraryFeed({ category: 'clinical', search: 'iron' });
    expect(feed.feature).toBeNull();
    expect(feed.articles.every((a) => a.category === 'clinical')).toBe(true);
    expect(feed.articles.some((a) => a.slug === 'perimenopause-bleeding-changes')).toBe(true);
  });
});

describe('getLibraryArticle', () => {
  it('returns article with body and up to three related summaries (same category first)', () => {
    const result = getLibraryArticle('hrt-myths-and-facts');

    expect(result).not.toBeNull();
    expect(result!.article.slug).toBe('hrt-myths-and-facts');
    expect(result!.article.category).toBe('clinical');
    expect(result!.article.blocks.length).toBeGreaterThan(0);
    expect(result!.related.length).toBeLessThanOrEqual(3);
    expect(result!.related.every((r) => r.slug !== result!.article.slug)).toBe(true);

    // Same-category peers should appear before other categories when present.
    const sameCategory = result!.related.filter((r) => r.category === 'clinical');
    const otherCategory = result!.related.filter((r) => r.category !== 'clinical');
    if (sameCategory.length > 0 && otherCategory.length > 0) {
      const lastSame = result!.related.lastIndexOf(sameCategory[sameCategory.length - 1]!);
      const firstOther = result!.related.indexOf(otherCategory[0]!);
      expect(lastSame).toBeLessThan(firstOther);
    }
  });

  it('returns null for unknown slug', () => {
    expect(getLibraryArticle('does-not-exist')).toBeNull();
  });
});

describe('getDailyInsight', () => {
  const at = (day: string) => new Date(`${day}T09:00:00+05:30`);
  // The feature is pulled out of `articles`, so add it back for the catalogue size.
  const total = getLibraryFeed({}).articles.length + 1;

  it('is the same pick for everyone on a given day and stable across calls', () => {
    const a = getDailyInsight(at('2026-08-28'));
    const b = getDailyInsight(new Date('2026-08-28T23:30:00+05:30'));

    expect(a).not.toBeNull();
    expect(a?.date).toBe('2026-08-28');
    expect(b).toEqual(a);
  });

  it('shows every article once before repeating any', () => {
    const start = new Date('2026-01-01T09:00:00+05:30');
    const slugs: string[] = [];

    for (let i = 0; i < total; i += 1) {
      const insight = getDailyInsight(new Date(start.getTime() + i * 86_400_000));
      expect(insight).not.toBeNull();
      slugs.push(insight!.article.slug);
    }

    expect(new Set(slugs).size).toBe(total);
  });

  it('never repeats an article inside any window of the catalogue length', () => {
    // Not just one aligned pass: a sliding window catches a reshuffle putting
    // yesterday's article at the head of the next pass.
    const start = new Date('2026-01-01T09:00:00+05:30');
    const slugs = Array.from(
      { length: total * 3 },
      (_, i) => getDailyInsight(new Date(start.getTime() + i * 86_400_000))!.article.slug
    );

    for (let i = 0; i + total <= slugs.length; i += 1) {
      expect(new Set(slugs.slice(i, i + total)).size).toBe(total);
    }
  });

  it('quotes a different takeaway on the next pass through the catalogue', () => {
    const day = new Date('2026-01-01T09:00:00+05:30');
    const first = getDailyInsight(day)!;
    const nextPass = getDailyInsight(new Date(day.getTime() + total * 86_400_000))!;

    expect(nextPass.article.slug).toBe(first.article.slug);
    expect(nextPass.text).not.toBe(first.text);
  });

  it('quotes a key takeaway of the article it links to', () => {
    const insight = getDailyInsight(at('2026-08-28'))!;
    const { article } = getLibraryArticle(insight.article.slug)!;

    expect(article.keyTakeaways).toContain(insight.text);
  });
});
