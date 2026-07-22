// ANU chat orchestration.
//
//   1. Red-flag gate   deterministic, pre-model, verbatim clinician text
//   2. Embed           OpenAI text-embedding-3-small, 512 dims
//   3. Cache lookup    in-memory cosine scan, >= 0.94 serves a stored reply
//   4. Generate        gpt-4o-mini with the measured few-shot prompt
//
// Every turn is written to AnuChatTurn with the reply snapshotted, so what a
// user was told on a given day stays reconstructible after prompts change.

import { prisma } from '@anuva/database';
import type { AnuChatResponse } from '@anuva/shared';
import { matchRedFlag } from './redFlags.js';
import { embedQuestion, generateReply } from './openai.js';
import { lookup, store } from './cache.js';
import { HISTORY_TURNS, PROMPT_VERSION, type PriorTurn } from './prompt.js';
import { findSymptom, followUpChips, logChip } from './symptoms.js';

/// A thread is considered continuous while replies keep coming within this
/// window; after it, the next message starts fresh.
const THREAD_IDLE_MS = 30 * 60 * 1000;

async function loadHistory(userId: string): Promise<PriorTurn[]> {
  const rows = await prisma.anuChatTurn.findMany({
    where: {
      userId,
      createdAt: { gte: new Date(Date.now() - THREAD_IDLE_MS) },
      // Safety replies are dead ends, not conversation the model should
      // continue from.
      source: { not: 'red_flag' },
    },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_TURNS,
    select: { userMessage: true, reply: true, symptom: true },
  });
  return rows.reverse();
}

/// Only the opening message of a thread may be cached.
///
/// Anything asked after it is answered in the context of that thread, so its
/// reply is not reusable: "Why does this happen?", "What can I do today?" and
/// "Should I see a doctor?" all mean something different depending on the
/// symptom above them. Caching one would key a fatigue answer under a question
/// a hot-flashes user asks too, and then serve it to her.
///
/// This is deliberately a structural rule rather than a test of the wording —
/// an earlier keyword/pronoun heuristic passed "What can I do today?" as
/// self-contained and cached it, which is exactly the bug it was meant to stop.
/// Opening messages are also the ones that actually repeat across users, so
/// almost none of the cache's value is lost.
function isCacheable(history: PriorTurn[]): boolean {
  return history.length === 0;
}

type TurnRecord = {
  userId: string;
  userMessage: string;
  reply: string;
  suggestions: string[];
  symptom?: string | null;
  source: 'red_flag' | 'cache' | 'model';
  redFlagArea?: string | null;
  cacheHitId?: string | null;
  similarity?: number | null;
};

async function recordTurn(turn: TurnRecord): Promise<void> {
  try {
    await prisma.anuChatTurn.create({
      data: {
        userId: turn.userId,
        userMessage: turn.userMessage,
        reply: turn.reply,
        suggestions: turn.suggestions,
        symptom: turn.symptom ?? null,
        source: turn.source,
        redFlagArea: turn.redFlagArea ?? null,
        cacheHitId: turn.cacheHitId ?? null,
        similarity: turn.similarity ?? null,
        promptVersion: PROMPT_VERSION,
      },
    });
  } catch (e) {
    // The audit write must never cost the user her reply.
    console.error('[anu] failed to record chat turn', e);
  }
}

export async function answer(userId: string, userMessage: string): Promise<AnuChatResponse> {
  // 1. Safety gate. Runs before the model sees anything, and its reply is the
  // clinician-authored string served verbatim.
  const flagged = matchRedFlag(userMessage);
  if (flagged) {
    const { rule, helplines } = flagged;
    // No chips on a safety turn. A crisis message must not be followed by
    // casual next-step buttons, and anything the model invented here would sit
    // beside clinician-authored text as though it were equally reviewed.
    await recordTurn({
      userId,
      userMessage,
      reply: rule.response,
      suggestions: [],
      source: 'red_flag',
      redFlagArea: rule.area,
    });
    return {
      reply: rule.response,
      suggestions: [],
      source: 'red_flag',
      escalation: {
        area: rule.area,
        urgency: rule.urgency,
        recommendedSpecialist: rule.recommendedSpecialist,
        helplines,
      },
    };
  }

  const history = await loadHistory(userId);
  const cacheable = isCacheable(history);

  // 2 + 3. Only self-contained questions touch the cache — both to read and to
  // write. Embedding is charged on those turns (a lookup needs a vector), but
  // at roughly $0.0000008 per question it is noise next to a completion.
  let embedding: Float32Array | null = null;
  let bestScore: number | null = null;
  if (cacheable) {
    embedding = await embedQuestion(userMessage);
    const result = await lookup(embedding);
    bestScore = result.bestScore;
    if (result.hit) {
      await recordTurn({
        userId,
        userMessage,
        reply: result.hit.reply,
        suggestions: result.hit.suggestions,
        symptom: result.hit.symptom,
        source: 'cache',
        cacheHitId: result.hit.id,
        similarity: result.hit.similarity,
      });
      return {
        reply: result.hit.reply,
        suggestions: result.hit.suggestions,
        source: 'cache',
        escalation: null,
      };
    }
  }

  // 4. Miss — generate with the thread's context, then remember it if the
  // question stands alone. The near-miss score is stored too, so the threshold
  // can be retuned from what real questions actually scored.
  const generated = await generateReply(userMessage, history);
  const reply = generated.reply;

  // The model only nominates a label; it is resolved against the bank here, so
  // anything it invented is dropped and the chips are always bank wording.
  const symptom = findSymptom(generated.symptom);
  const asked = [...history.map((h) => h.userMessage), userMessage];
  // On the turn a symptom is first raised, the bank's own "log this" CTA takes
  // one of the three slots; after that the slots are all follow-up questions.
  const isOpeningTurn = history.length === 0;
  const suggestions = symptom
    ? [
        ...followUpChips(symptom, asked).slice(0, isOpeningTurn ? 2 : 3),
        ...(isOpeningTurn ? [logChip(symptom)] : []),
      ]
    : [];

  if (cacheable && embedding) {
    await store(userMessage, reply, suggestions, symptom?.label ?? null, embedding).catch((e) => {
      console.error('[anu] failed to store cache entry', e);
    });
  }
  await recordTurn({
    userId,
    userMessage,
    reply,
    suggestions,
    symptom: symptom?.label ?? null,
    source: 'model',
    similarity: bestScore,
  });

  return { reply, suggestions, source: 'model', escalation: null };
}
