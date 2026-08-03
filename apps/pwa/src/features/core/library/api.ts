import type {
  LibraryArticleResponse,
  LibraryCategory,
  LibraryFeedResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function fetchLibraryFeed(params?: {
  category?: LibraryCategory;
  search?: string;
}): Promise<LibraryFeedResponse> {
  const search = new URLSearchParams();
  if (params?.category) search.set('category', params.category);
  if (params?.search?.trim()) search.set('search', params.search.trim());
  const query = search.toString();

  return apiFetch<LibraryFeedResponse>(query ? `/api/library?${query}` : '/api/library');
}

export async function fetchLibraryArticle(slug: string): Promise<LibraryArticleResponse> {
  return apiFetch<LibraryArticleResponse>(`/api/library/articles/${encodeURIComponent(slug)}`);
}
