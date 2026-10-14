// One structured-output completion. Reuses the classic engine's transport
// (openaiFetch: key, base URL, timeout) but not its sampling: v3 runs two calls
// with different jobs, and each gets its own model and effort.

import { openaiFetch } from '../openai.js';

// Read lazily — see the note in openai.ts.
//
// v3 does not fall back to ANU_CHAT_MODEL: that setting belongs to the classic
// engine, and a server that still had it on gpt-4o-mini silently ran v3 — whose
// prompt was written for a reasoning model — on it too.
export const V3_DEFAULT_MODEL = 'gpt-6-luna';

export const v3Env = {
  replyModel: () => process.env.ANU_V3_MODEL?.trim() || V3_DEFAULT_MODEL,
  classifierModel: () =>
    process.env.ANU_V3_CLASSIFIER_MODEL?.trim() || process.env.ANU_V3_MODEL?.trim() || V3_DEFAULT_MODEL,
  // The reply follows a long clinical-safety prompt, so it is given a little
  // room to think; the classifier is a short rubric and stays at the lowest
  // effort the model takes.
  replyEffort: () => process.env.ANU_V3_REASONING_EFFORT?.trim() || 'low',
  classifierEffort: () => process.env.ANU_V3_CLASSIFIER_REASONING_EFFORT?.trim() || 'low',
};

/// Same split as openai.ts: the GPT-5 / GPT-6 / o-series families reject
/// `temperature` and spend their token cap on reasoning before they write, so
/// the cap is loose.
const REASONING_MODEL = /^(gpt-5|gpt-6|o[134])/;

/// GPT-6 takes none/low/medium/high/xhigh/max — no "minimal", which GPT-5 uses
/// and the env example once set for the classifier. Sent as is it is a 400, so
/// it is read as the nearest effort GPT-6 has.
function effortFor(model: string, effort: string): string {
  return /^gpt-6/.test(model) && effort === 'minimal' ? 'low' : effort;
}

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
    ? { max_completion_tokens: 3000, reasoning_effort: effortFor(model, options.effort) }
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
