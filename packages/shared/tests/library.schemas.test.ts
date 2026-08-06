import { describe, expect, it } from 'vitest';
import {
  libraryArticleParamsSchema,
  libraryArticleResponseSchema,
  libraryArticleSchema,
  libraryArticleSummarySchema,
  libraryAuthorSchema,
  libraryBlockSchema,
  libraryCategoryFacetSchema,
  libraryCategorySchema,
  libraryContentFileSchema,
  libraryFeedQuerySchema,
  libraryFeedResponseSchema,
  librarySessionSchema,
  libraryToneSchema,
} from '../src/library.js';

const author = { name: 'Dr. Mehta', credential: 'MD' };

const articleSummary = {
  slug: 'sleep-and-oestrogen',
  category: 'sleep' as const,
  categoryLabel: 'Sleep',
  tone: 'lilac' as const,
  glyph: 'moon',
  title: 'Sleep and oestrogen',
  dek: 'Why nights get lighter.',
  readMinutes: 5,
  author,
  publishedAt: '2026-01-10',
  featured: true,
};

describe('libraryCategorySchema / libraryToneSchema', () => {
  it.each(['nutrition', 'movement', 'mind', 'clinical', 'sleep'] as const)(
    'accepts category %s',
    (category) => {
      expect(libraryCategorySchema.parse(category)).toBe(category);
    },
  );

  it.each(['mint', 'butter', 'blush', 'lilac', 'sand'] as const)('accepts tone %s', (tone) => {
    expect(libraryToneSchema.parse(tone)).toBe(tone);
  });

  it('rejects unknown category and tone', () => {
    expect(libraryCategorySchema.safeParse('hormones').success).toBe(false);
    expect(libraryToneSchema.safeParse('violet').success).toBe(false);
  });
});

describe('libraryBlockSchema', () => {
  it('accepts each block discriminant', () => {
    expect(libraryBlockSchema.parse({ type: 'paragraph', text: 'Hello' })).toEqual({
      type: 'paragraph',
      text: 'Hello',
    });
    expect(libraryBlockSchema.parse({ type: 'heading', text: 'H2' })).toMatchObject({
      type: 'heading',
    });
    expect(libraryBlockSchema.parse({ type: 'list', items: ['a'] })).toEqual({
      type: 'list',
      items: ['a'],
    });
    expect(
      libraryBlockSchema.parse({ type: 'quote', text: 'Stay curious', attribution: 'Anu' }),
    ).toMatchObject({ attribution: 'Anu' });
    expect(
      libraryBlockSchema.parse({ type: 'quote', text: 'Stay curious' }),
    ).not.toHaveProperty('attribution');
    expect(
      libraryBlockSchema.parse({ type: 'callout', title: 'Note', text: 'Body' }),
    ).toMatchObject({ type: 'callout' });
  });

  it('rejects empty list items', () => {
    expect(libraryBlockSchema.safeParse({ type: 'list', items: [] }).success).toBe(false);
  });

  it('rejects unknown type', () => {
    expect(libraryBlockSchema.safeParse({ type: 'image', url: '/x.png' }).success).toBe(false);
  });
});

describe('libraryAuthorSchema', () => {
  it('accepts name and credential', () => {
    expect(libraryAuthorSchema.parse(author)).toEqual(author);
  });

  it('rejects missing credential', () => {
    expect(libraryAuthorSchema.safeParse({ name: 'Dr. Mehta' }).success).toBe(false);
  });
});

describe('libraryArticleSummarySchema / libraryArticleSchema', () => {
  it('accepts a summary', () => {
    expect(libraryArticleSummarySchema.parse(articleSummary)).toEqual(articleSummary);
  });

  it('rejects non-positive readMinutes', () => {
    expect(
      libraryArticleSummarySchema.safeParse({ ...articleSummary, readMinutes: 0 }).success,
    ).toBe(false);
  });

  it('accepts a full article with blocks', () => {
    const article = {
      ...articleSummary,
      heroCaption: 'Night sky',
      keyTakeaways: ['Cooler room helps'],
      tags: ['sleep'],
      blocks: [{ type: 'paragraph' as const, text: 'Body copy.' }],
    };
    expect(libraryArticleSchema.parse(article)).toEqual(article);
  });

  it('rejects article with empty blocks', () => {
    expect(
      libraryArticleSchema.safeParse({
        ...articleSummary,
        heroCaption: 'Night sky',
        keyTakeaways: [],
        tags: [],
        blocks: [],
      }).success,
    ).toBe(false);
  });
});

describe('librarySessionSchema', () => {
  it('accepts a session', () => {
    expect(
      librarySessionSchema.parse({
        id: 'mc-1',
        kicker: 'Live',
        title: 'Masterclass',
        dateLabel: 'Aug 12',
        live: true,
      }),
    ).toMatchObject({ live: true });
  });

  it('rejects missing live', () => {
    expect(
      librarySessionSchema.safeParse({
        id: 'mc-1',
        kicker: 'Live',
        title: 'Masterclass',
        dateLabel: 'Aug 12',
      }).success,
    ).toBe(false);
  });
});

describe('libraryCategoryFacetSchema', () => {
  it('accepts nonnegative count', () => {
    expect(
      libraryCategoryFacetSchema.parse({
        key: 'mind',
        label: 'Mind',
        tone: 'blush',
        count: 0,
      }),
    ).toMatchObject({ count: 0 });
  });

  it('rejects negative count', () => {
    expect(
      libraryCategoryFacetSchema.safeParse({
        key: 'mind',
        label: 'Mind',
        tone: 'blush',
        count: -1,
      }).success,
    ).toBe(false);
  });
});

describe('libraryFeedQuerySchema', () => {
  it('accepts empty query', () => {
    expect(libraryFeedQuerySchema.parse({})).toEqual({});
  });

  it('accepts category and trimmed search', () => {
    expect(
      libraryFeedQuerySchema.parse({ category: 'nutrition', search: '  protein  ' }),
    ).toEqual({ category: 'nutrition', search: 'protein' });
  });

  it('rejects blank search after trim', () => {
    expect(libraryFeedQuerySchema.safeParse({ search: '   ' }).success).toBe(false);
  });

  it('rejects search over 80 chars', () => {
    expect(libraryFeedQuerySchema.safeParse({ search: 'x'.repeat(81) }).success).toBe(false);
  });
});

describe('libraryFeedResponseSchema', () => {
  it('accepts null feature/session', () => {
    expect(
      libraryFeedResponseSchema.parse({
        feature: null,
        session: null,
        categories: [],
        articles: [articleSummary],
      }),
    ).toMatchObject({ feature: null, articles: [articleSummary] });
  });

  it('rejects missing categories', () => {
    expect(
      libraryFeedResponseSchema.safeParse({
        feature: null,
        session: null,
        articles: [],
      }).success,
    ).toBe(false);
  });
});

describe('libraryArticleParamsSchema / libraryArticleResponseSchema', () => {
  it('accepts non-empty slug', () => {
    expect(libraryArticleParamsSchema.parse({ slug: 'sleep-and-oestrogen' })).toEqual({
      slug: 'sleep-and-oestrogen',
    });
  });

  it('rejects empty slug', () => {
    expect(libraryArticleParamsSchema.safeParse({ slug: '' }).success).toBe(false);
  });

  it('accepts article response with related', () => {
    const article = {
      ...articleSummary,
      heroCaption: 'Night sky',
      keyTakeaways: ['Cooler room helps'],
      tags: ['sleep'],
      blocks: [{ type: 'paragraph' as const, text: 'Body copy.' }],
    };
    expect(
      libraryArticleResponseSchema.parse({ article, related: [articleSummary] }),
    ).toMatchObject({ related: [articleSummary] });
  });
});

describe('libraryContentFileSchema', () => {
  it('accepts authored content without categoryLabel/tone on articles', () => {
    const file = {
      session: null,
      categories: [{ key: 'sleep' as const, label: 'Sleep', tone: 'lilac' as const }],
      articles: [
        {
          slug: 'sleep-and-oestrogen',
          category: 'sleep' as const,
          glyph: 'moon',
          title: 'Sleep and oestrogen',
          dek: 'Why nights get lighter.',
          readMinutes: 5,
          author,
          publishedAt: '2026-01-10',
          featured: true,
          heroCaption: 'Night sky',
          keyTakeaways: ['Cooler room helps'],
          tags: ['sleep'],
          blocks: [{ type: 'paragraph' as const, text: 'Body copy.' }],
        },
      ],
    };
    expect(libraryContentFileSchema.parse(file).articles[0]).not.toHaveProperty('tone');
  });

  it('rejects content article that still requires blocks', () => {
    expect(
      libraryContentFileSchema.safeParse({
        session: null,
        categories: [],
        articles: [
          {
            slug: 'x',
            category: 'mind',
            glyph: 'g',
            title: 't',
            dek: 'd',
            readMinutes: 1,
            author,
            publishedAt: '2026-01-01',
            heroCaption: 'h',
            keyTakeaways: [],
            tags: [],
            blocks: [],
          },
        ],
      }).success,
    ).toBe(false);
  });
});
