import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  libraryContentFileSchema,
  type LibraryArticle,
  type LibraryArticleResponse,
  type LibraryArticleSummary,
  type LibraryCategoryFacet,
  type LibraryDailyInsightResponse,
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

/// Today's insight.
///
/// The pick is a pure function of the calendar day: no per-user state, no
/// database, so everyone opening the app on the same day sees the same line,
/// and a reinstall or a second device cannot resync it.
///
/// Rotation walks one fixed, seeded shuffle of the catalogue, one article per
/// day. That single order is what makes the no-repeat promise hold at every
/// point, not only inside an arbitrary window: an article cannot return until
/// all N others have been shown. Reshuffling per pass would break it — a fresh
/// permutation can put yesterday's article first tomorrow. What does change per
/// pass is which key takeaway is quoted, so a second walk through the
/// catalogue is not a second walk through the same sentences.
const ROTATION_TZ = process.env.NUDGE_TIMEZONE?.trim() || 'Asia/Kolkata';

/// `YYYY-MM-DD` for `at` in the rotation timezone. `en-CA` is ISO-ordered.
function rotationDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ROTATION_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/// Whole days since the epoch for a `YYYY-MM-DD` day. The day string is already
/// timezone-resolved, so parsing it as UTC keeps the arithmetic exact.
function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/// Fisher-Yates driven by a seeded PRNG — same seed, same order, on every
/// process and every deploy.
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = items.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    out[i] = out[j] as T;
    out[j] = a;
  }
  return out;
}

/// The rotation order. Shuffled off a stable slug sort — `articles` is sorted by
/// `publishedAt`, so ordering off that would reshuffle the whole rotation every
/// time a piece is published. `ROTATION_SEED` is arbitrary; changing it reorders
/// the rotation, which is the only reason to touch it.
const ROTATION_SEED = 0x616e75;

let rotationCache: LibraryArticle[] | null = null;

function rotationOrder(): LibraryArticle[] {
  if (!rotationCache) {
    const bySlug = [...library().articles].sort((a, b) => a.slug.localeCompare(b.slug));
    rotationCache = shuffled(bySlug, ROTATION_SEED);
  }
  return rotationCache;
}

export function getDailyInsight(at: Date = new Date()): LibraryDailyInsightResponse | null {
  const { articles } = library();
  if (articles.length === 0) return null;

  const date = rotationDay(at);
  const total = articles.length;
  const day = dayNumber(date);
  // `day` is positive for every date after 1970, so `%` needs no rescue.
  const pass = Math.floor(day / total);
  const position = day % total;

  const article = rotationOrder()[position];
  if (!article) return null;

  const takeaways = article.keyTakeaways;
  const text = takeaways[pass % takeaways.length] ?? article.dek;

  return { date, text, article: toSummary(article) };
}
