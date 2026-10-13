// One structured-output completion. Reuses the classic engine's transport
// (openaiFetch: key, base URL, timeout) but not its sampling: v3 runs two calls
// with different jobs, and each gets its own model and effort.

import { openaiFetch } from '../openai.js';

// Read lazily — see the note in openai.ts.
export const v3Env = {
  replyModel: () =>
    process.env.ANU_V3_MODEL?.trim() || process.env.ANU_CHAT_MODEL?.trim() || 'gpt-5-mini',
  classifierModel: () =>
    process.env.ANU_V3_CLASSIFIER_MODEL?.trim() ||
    process.env.ANU_V3_MODEL?.trim() ||
    process.env.ANU_CHAT_MODEL?.trim() ||
    'gpt-5-mini',
  // The reply follows a long clinical-safety prompt, so it is given a little
  // room to think; the classifier is a short rubric and stays at minimal.
  replyEffort: () => process.env.ANU_V3_REASONING_EFFORT?.trim() || 'low',
  classifierEffort: () => process.env.ANU_V3_CLASSIFIER_REASONING_EFFORT?.trim() || 'minimal',
};

/// Same split as openai.ts: the GPT-5 / o-series family rejects `temperature`
/// and spends its token cap on reasoning before it writes, so the cap is loose.
const REASONING_MODEL = /^(gpt-5|o[134])/;

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type ChatResponse = { choices: { message: { content: string | null; refusal?: string | null } }[] };

export async function chatJson(options: {
  model: string;
  effort: string;
  temperature: number;
  messages: ChatMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<unknown> {
  const { model } = options;
  const sampling = REASONING_MODEL.test(model)
    ? { max_completion_tokens: 3000, reasoning_effort: options.effort }
    : { temperature: options.temperature, max_tokens: 700 };

  const json = await openaiFetch<ChatResponse>('/chat/completions', {
    model,
    ...sampling,
    response_format: {
      type: 'json_schema',
      json_schema: { name: options.schemaName, strict: true, schema: options.schema },
    },
    messages: options.messages,
  });

  const message = json.choices[0]?.message;
  const raw = message?.content?.trim();
  if (!raw) {
    throw new Error(
      `OpenAI returned no content for ${options.schemaName} (model ${model})${
        message?.refusal ? `: refusal — ${message.refusal}` : ''
      }`,
    );
  }
  return JSON.parse(raw);
}
