// Thin OpenAI client. Uses fetch directly rather than the SDK — two endpoints
// are all this feature needs, and the API already avoids extra dependencies.

import { buildMessages, type PriorTurn } from './prompt.js';

// Read lazily, never at module scope: index.ts calls dotenv `config()` in its
// body, but ES imports are hoisted, so anything captured here at import time
// would see the environment as it was before .env was loaded.
const env = {
  baseUrl: () => process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
  apiKey: () => process.env.OPENAI_API_KEY?.trim() || '',
  chatModel: () => process.env.ANU_CHAT_MODEL?.trim() || 'gpt-5-mini',
  embedModel: () => process.env.ANU_EMBED_MODEL?.trim() || 'text-embedding-3-small',
  timeoutMs: () => Number(process.env.ANU_CHAT_TIMEOUT_MS || 20000),
};

/// 512 is a `text-embedding-3-small` shortened output. Plenty of separation for
/// question matching, and a quarter of the storage of the 1536-dim default.
export const EMBED_DIMENSIONS = 512;

export function isAnuChatConfigured(): boolean {
  return env.apiKey().length > 0;
}

async function openaiFetch<T>(path: string, body: unknown): Promise<T> {
  const apiKey = env.apiKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.timeoutMs());
  try {
    const res = await fetch(`${env.baseUrl()}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`OpenAI ${path} failed (${res.status}): ${detail.slice(0, 300)}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type EmbeddingResponse = { data: { embedding: number[] }[] };

/// Returns a unit-normalised vector, so cosine similarity is a plain dot
/// product at lookup time.
export async function embedQuestion(text: string): Promise<Float32Array> {
  const json = await openaiFetch<EmbeddingResponse>('/embeddings', {
    model: env.embedModel(),
    input: text,
    dimensions: EMBED_DIMENSIONS,
  });

  const raw = json.data[0]?.embedding;
  if (!raw || raw.length !== EMBED_DIMENSIONS) {
    throw new Error(`Unexpected embedding length: ${raw?.length ?? 'none'}`);
  }

  const vec = Float32Array.from(raw);
  let norm = 0;
  for (let i = 0; i < vec.length; i += 1) {
    const v = vec[i] as number;
    norm += v * v;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < vec.length; i += 1) vec[i] = (vec[i] as number) / norm;
  }
  return vec;
}

type ChatResponse = { choices: { message: { content: string } }[] };

export type GeneratedReply = { reply: string; symptom: string | null };

/// The model is asked for JSON, but a malformed or partial response must still
/// produce something usable rather than a failed turn.
function parseReply(raw: string): GeneratedReply {
  try {
    const parsed = JSON.parse(raw) as { reply?: unknown; symptom?: unknown };
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : '';
    if (!reply) throw new Error('missing reply');

    // Whatever comes back is only a candidate — the caller resolves it against
    // the bank's own labels and discards anything that does not match, so an
    // invented label cannot reach the user.
    const symptom =
      typeof parsed.symptom === 'string' && parsed.symptom.trim() ? parsed.symptom.trim() : null;

    return { reply, symptom };
  } catch {
    // Fall back to treating the whole output as the answer, with no chips —
    // better a reply without follow-ups than a failed turn.
    return { reply: raw.trim(), symptom: null };
  }
}

/// The GPT-5 and o-series families take a different set of sampling parameters
/// from the GPT-4 chat models, and sending the wrong set is a 400 rather than a
/// silently ignored field. So ANU_CHAT_MODEL cannot be swapped by itself — the
/// body has to follow the family.
const REASONING_MODEL = /^(gpt-5|o[134])/;

/// The reply the user reads runs ~100 tokens on either family. The difference is
/// that a reasoning model spends tokens thinking BEFORE it writes, and that
/// spend counts against the same cap: set it to 320 and the model can use the
/// whole budget reasoning and return an empty `content`, which surfaces here as
/// a failed turn rather than a short one. So the cap is loose and the length is
/// governed by the prompt instead, and `reasoning_effort` is held at minimal —
/// this is a voice task, not a maths one, and thinking longer does not make the
/// reply warmer.
const REASONING_MAX_TOKENS = 1500;

function samplingParams(model: string): Record<string, unknown> {
  if (REASONING_MODEL.test(model)) {
    // temperature is not accepted by this family at all — sending it 400s.
    return { max_completion_tokens: REASONING_MAX_TOKENS, reasoning_effort: 'minimal' };
  }
  return {
    // 0.4-0.5 was measured for the differential-completeness numbers, but sat
    // low enough that the model reused one opening line for every symptom.
    // 0.7 restores variety in wording; the medical content is constrained by
    // the prompt and few-shot rather than by temperature.
    temperature: 0.7,
    // Coach replies run ~100 tokens; the cap stops a runaway paragraph and
    // bounds the most expensive part of the turn (output bills at 4x input).
    // Raised from 220 to leave room for the JSON envelope and chips.
    max_tokens: 320,
  };
}

export async function generateReply(
  userMessage: string,
  history: PriorTurn[] = [],
  name: string | null = null,
  sheTyped = true,
  /// An extra turn-specific instruction, inserted as a system message directly
  /// before her message — the same position nameDirective occupies, and for the
  /// same reason: it is a judgement about the turn, so it has to be read after
  /// the history rather than buried at the top of a 3.5k-token prompt.
  ///
  /// Used only by the probe ladder (see probe/engine.ts), which appends its own
  /// authored question after the reply and therefore needs the model to stop
  /// asking one of its own. Never carries clinical content.
  directive: string | null = null,
): Promise<GeneratedReply> {
  const model = env.chatModel();
  const messages = buildMessages(userMessage, history, name, sheTyped);
  if (directive) messages.splice(messages.length - 1, 0, { role: 'system', content: directive });
  const json = await openaiFetch<ChatResponse>('/chat/completions', {
    model,
    response_format: { type: 'json_object' },
    ...samplingParams(model),
    messages,
  });

  const raw = json.choices[0]?.message?.content?.trim();
  if (!raw) {
    // A reasoning model that spent its whole budget thinking lands here, and the
    // fix is the cap rather than a retry — say so instead of leaving a bare
    // "empty reply" for whoever reads the logs.
    throw new Error(
      `OpenAI returned an empty reply (model ${model}). If this is a reasoning model, its token cap may be exhausted by reasoning before any content is written.`,
    );
  }
  return parseReply(raw);
}
