// The chat entry point. One call, one flag.
//
// `chatMode` decides per user, not globally, so the ladder and the classic
// engine can run on the same traffic at the same time — which is the only way
// to find out whether five questions beat one guess. See config.ts for the
// rollout controls (ANU_CHAT_MODE, ANU_PROBE_USER_IDS, ANU_PROBE_PERCENT).

import type { AnuChatResponse } from '@anuva/shared';
import { chatMode } from './config.js';
import { currentLanguage } from '../i18n/index.js';
import { answer as classicAnswer } from './engine.js';
import { answer as probeAnswer } from './probe/engine.js';

export { chatMode, type AnuChatMode } from './config.js';
export { isAnuChatConfigured } from './openai.js';

export function answer(
  userId: string,
  userMessage: string,
  userName?: string | null,
): Promise<AnuChatResponse> {
  const mode = chatMode(userId);
  if (mode !== 'probe') return classicAnswer(userId, userMessage, userName);

  // The ladder is authored English — its questions, options and the patterns that enter it — and is
  // not yet clinician-reviewed, so it is not translated. In any other language she gets the model,
  // which replies in her language, written to the same probe thread so her history stays whole.
  return currentLanguage() === 'en'
    ? probeAnswer(userId, userMessage, userName)
    : classicAnswer(userId, userMessage, userName, 'probe');
}
