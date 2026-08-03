import type {
  AnonymousQuestionStatus,
  AnswerAnonymousQuestionResponse,
  DoctorQuestionsResponse,
} from '@anuva/shared';
import { apiFetch } from '../../lib/api';

export async function fetchDoctorQuestions(params?: {
  status?: AnonymousQuestionStatus;
}): Promise<DoctorQuestionsResponse> {
  const search = new URLSearchParams();
  if (params?.status) search.set('status', params.status);
  const query = search.toString();

  return apiFetch<DoctorQuestionsResponse>(
    query ? `/api/doctor/questions?${query}` : '/api/doctor/questions',
  );
}

export async function answerDoctorQuestion(
  questionId: string,
  body: string,
): Promise<AnswerAnonymousQuestionResponse> {
  return apiFetch<AnswerAnonymousQuestionResponse>(`/api/doctor/questions/${questionId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
}
