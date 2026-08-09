import { describe, expect, it } from 'vitest';
import { getLibraryArticle, getLibraryFeed } from '../src/library.js';

describe('getLibraryFeed', () => {
  it('returns featured article as feature on unfiltered feed and excludes it from articles', () => {
    const feed = getLibraryFeed({});

    expect(feed.feature).not.toBeNull();
    expect(feed.feature?.featured).toBe(true);
    expect(feed.feature?.slug).toBe('hot-flashes-and-your-sleep');
    expect(feed.session?.id).toBe('masterclass-sleep-as-medicine');
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
