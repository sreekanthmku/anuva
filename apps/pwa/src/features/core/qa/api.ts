import type {
  AnonymousQuestionFeedResponse,
  AnonymousQuestionTopic,
  CreateAnonymousQuestionBody,
  CreateAnonymousQuestionResponse,
  MyAnonymousQuestionsResponse,
} from '@anuva/shared';
import { apiFetch } from '../../../shared/lib/api';

export async function askAnonymousQuestion(
  body: CreateAnonymousQuestionBody
): Promise<CreateAnonymousQuestionResponse> {
  return apiFetch<CreateAnonymousQuestionResponse>('/api/questions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchMyAnonymousQuestions(): Promise<MyAnonymousQuestionsResponse> {
  return apiFetch<MyAnonymousQuestionsResponse>('/api/questions/mine');
}

export async function fetchAnonymousQuestionFeed(params?: {
  topic?: AnonymousQuestionTopic;
  limit?: number;
}): Promise<AnonymousQuestionFeedResponse> {
  const search = new URLSearchParams();
  if (params?.topic) search.set('topic', params.topic);
  if (params?.limit) search.set('limit', String(params.limit));
  const query = search.toString();

  return apiFetch<AnonymousQuestionFeedResponse>(
    query ? `/api/questions/feed?${query}` : '/api/questions/feed'
  );
}
