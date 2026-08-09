import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  libraryContentFileSchema,
  type LibraryArticle,
  type LibraryArticleResponse,
  type LibraryArticleSummary,
  type LibraryCategoryFacet,
  type LibraryFeedQuery,
  type LibraryFeedResponse,
} from '@anuva/shared';

/// The library is editorial content, not user data. It is authored in
/// `data/library.json`, read once at boot, and served read-only — no database
/// table, no admin CRUD. Editing the JSON and restarting is the publish flow.
const CONTENT_PATH = fileURLToPath(new URL('./data/library.json', import.meta.url));

type LoadedLibrary = {
  session: LibraryFeedResponse['session'];
  categories: LibraryCategoryFacet[];
  articles: LibraryArticle[];
  bySlug: Map<string, LibraryArticle>;
};

function loadLibrary(): LoadedLibrary {
  // Parse eagerly so a malformed content file fails at boot rather than on the
  // first request.
  const file = libraryContentFileSchema.parse(JSON.parse(readFileSync(CONTENT_PATH, 'utf8')));

  const categoryMeta = new Map(file.categories.map((c) => [c.key, c]));

  const articles: LibraryArticle[] = file.articles.map((article) => {
    const meta = categoryMeta.get(article.category);
    if (!meta) {
      throw new Error(`library.json: article "${article.slug}" has unknown category`);
    }

    return {
      ...article,
      categoryLabel: meta.label,
      tone: meta.tone,
      featured: article.featured ?? false,
    };
  });

  // Newest first — `publishedAt` is an ISO date, so lexical sort is correct.
  articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const categories: LibraryCategoryFacet[] = file.categories.map((c) => ({
    ...c,
    count: articles.filter((a) => a.category === c.key).length,
  }));

  return {
    session: file.session,
    categories,
    articles,
    bySlug: new Map(articles.map((a) => [a.slug, a])),
  };
}

let cached: LoadedLibrary | null = null;

function library(): LoadedLibrary {
  cached ??= loadLibrary();
  return cached;
}

/// Cards never carry the body — the detail endpoint is the only place blocks
/// are sent.
function toSummary(article: LibraryArticle): LibraryArticleSummary {
  return {
    slug: article.slug,
    category: article.category,
    categoryLabel: article.categoryLabel,
    tone: article.tone,
    glyph: article.glyph,
    title: article.title,
    dek: article.dek,
    image: article.image,
    readMinutes: article.readMinutes,
    author: article.author,
    publishedAt: article.publishedAt,
    featured: article.featured,
  };
}

export function getLibraryFeed(query: LibraryFeedQuery): LibraryFeedResponse {
  const { session, categories, articles } = library();
  const filtering = Boolean(query.category || query.search);
  const needle = query.search?.toLowerCase();

  const matches = articles.filter((article) => {
    if (query.category && article.category !== query.category) return false;
    if (!needle) return true;

    return (
      article.title.toLowerCase().includes(needle) ||
      article.dek.toLowerCase().includes(needle) ||
      article.tags.some((tag) => tag.toLowerCase().includes(needle))
    );
  });

  // The hero is only meaningful on the unfiltered feed; when a filter is on,
  // the featured piece stays in the list instead of being pulled out of it.
  const feature = filtering ? null : (matches.find((a) => a.featured) ?? null);

  return {
    feature: feature ? toSummary(feature) : null,
    session,
    categories,
    articles: matches.filter((a) => a !== feature).map(toSummary),
  };
}

export function getLibraryArticle(slug: string): LibraryArticleResponse | null {
  const { articles, bySlug } = library();
  const article = bySlug.get(slug);
  if (!article) return null;

  // Same category first, then anything else, to keep the rail full on
  // categories that only have one or two pieces.
  const others = articles.filter((a) => a.slug !== slug);
  const related = [
    ...others.filter((a) => a.category === article.category),
    ...others.filter((a) => a.category !== article.category),
  ].slice(0, 3);

  return { article, related: related.map(toSummary) };
}
