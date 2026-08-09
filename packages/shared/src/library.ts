import { z } from 'zod';

/// Library content is editorial, not user data: it is authored as JSON in the
/// API and served read-only. These schemas are the contract for that JSON as
/// well as for the wire responses.

export const libraryCategorySchema = z.enum([
  'nutrition',
  'movement',
  'mind',
  'clinical',
  'sleep',
]);

/// Card accent, chosen per category by the content file — never by the client.
export const libraryToneSchema = z.enum(['mint', 'butter', 'blush', 'lilac', 'sand']);

export const libraryBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string() }),
  z.object({ type: z.literal('heading'), text: z.string() }),
  z.object({ type: z.literal('list'), items: z.array(z.string()).min(1) }),
  z.object({ type: z.literal('quote'), text: z.string(), attribution: z.string().optional() }),
  z.object({ type: z.literal('callout'), title: z.string(), text: z.string() }),
]);

export const libraryAuthorSchema = z.object({
  name: z.string(),
  credential: z.string(),
});

/// Everything needed to render a card. Detail views add `blocks` on top.
export const libraryArticleSummarySchema = z.object({
  slug: z.string(),
  category: libraryCategorySchema,
  categoryLabel: z.string(),
  tone: libraryToneSchema,
  glyph: z.string(),
  title: z.string(),
  /// Standfirst under the title — one or two sentences.
  dek: z.string(),
  /// Hero artwork, also used as the card thumbnail. Absent means the card falls
  /// back to its category glyph and the detail view renders no hero.
  image: z.string().url().optional(),
  readMinutes: z.number().int().positive(),
  author: libraryAuthorSchema,
  publishedAt: z.string(),
  featured: z.boolean(),
});

export const libraryArticleSchema = libraryArticleSummarySchema.extend({
  /// Provenance record for the hero photo, kept in the content file so the source of every
  /// image stays traceable. Deliberately not rendered.
  heroCaption: z.string().optional(),
  keyTakeaways: z.array(z.string()),
  tags: z.array(z.string()),
  blocks: z.array(libraryBlockSchema).min(1),
});

/// A scheduled masterclass. `live` only marks it as the current highlight —
/// it is not a real-time signal.
export const librarySessionSchema = z.object({
  id: z.string(),
  kicker: z.string(),
  title: z.string(),
  dateLabel: z.string(),
  live: z.boolean(),
});

export const libraryCategoryFacetSchema = z.object({
  key: libraryCategorySchema,
  label: z.string(),
  tone: libraryToneSchema,
  count: z.number().int().nonnegative(),
});

export const libraryFeedQuerySchema = z.object({
  category: libraryCategorySchema.optional(),
  search: z.string().trim().min(1).max(80).optional(),
});

export const libraryFeedResponseSchema = z.object({
  /// Omitted when a filter is active — the feature is the unfiltered hero.
  feature: libraryArticleSummarySchema.nullable(),
  session: librarySessionSchema.nullable(),
  categories: z.array(libraryCategoryFacetSchema),
  articles: z.array(libraryArticleSummarySchema),
});

export const libraryArticleParamsSchema = z.object({
  slug: z.string().min(1),
});

export const libraryArticleResponseSchema = z.object({
  article: libraryArticleSchema,
  related: z.array(libraryArticleSummarySchema),
});

/// Shape of the authored content file the API reads at boot.
export const libraryContentFileSchema = z.object({
  session: librarySessionSchema.nullable(),
  categories: z.array(
    z.object({
      key: libraryCategorySchema,
      label: z.string(),
      tone: libraryToneSchema,
    }),
  ),
  articles: z.array(
    libraryArticleSchema.omit({ categoryLabel: true, tone: true }).extend({
      featured: z.boolean().optional(),
    }),
  ),
});

export type LibraryCategory = z.infer<typeof libraryCategorySchema>;
export type LibraryTone = z.infer<typeof libraryToneSchema>;
export type LibraryBlock = z.infer<typeof libraryBlockSchema>;
export type LibraryAuthor = z.infer<typeof libraryAuthorSchema>;
export type LibraryArticleSummary = z.infer<typeof libraryArticleSummarySchema>;
export type LibraryArticle = z.infer<typeof libraryArticleSchema>;
export type LibrarySession = z.infer<typeof librarySessionSchema>;
export type LibraryCategoryFacet = z.infer<typeof libraryCategoryFacetSchema>;
export type LibraryFeedQuery = z.infer<typeof libraryFeedQuerySchema>;
export type LibraryFeedResponse = z.infer<typeof libraryFeedResponseSchema>;
export type LibraryArticleParams = z.infer<typeof libraryArticleParamsSchema>;
export type LibraryArticleResponse = z.infer<typeof libraryArticleResponseSchema>;
export type LibraryContentFile = z.infer<typeof libraryContentFileSchema>;
