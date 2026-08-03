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
import { HISTORY_TURNS, PROMPT_VERSION, sanitizeName, type PriorTurn } from './prompt.js';
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

/// The cache is shared across users, so a reply that addressed her by name
/// cannot be stored as written — it would greet the next woman as Priya.
///
/// Dropping those replies from the cache instead is not an option: only the
/// OPENING message of a thread is cacheable (see isCacheable), and the opening
/// turn is exactly where the prompt tells ANU to use her name. The two sets
/// overlap almost completely, so refusing to store them would leave the cache
/// permanently near-empty and put a completion behind every first question.
///
/// So the name is swapped for a token on the way in and re-slotted on the way
/// out. Anything still carrying the real name after templating is not stored at
/// all — see templateForCache.
const NAME_TOKEN = '{{name}}';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}

/// Matches the name plus any word characters glued to it, so "Priyaji" and
/// "Priyas" template out too rather than slipping past a strict word boundary.
function nameMatcher(name: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(name)}\\w*`, 'giu');
}

/// Accents off, case off. A profile name of "Priyā" reaches the model with its
/// macron, but the model may well type "Priya" — which the exact matcher above
/// cannot see. Comparing folded forms catches that, and the row is dropped
/// rather than stored with a real name in it.
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/// Only a VOCATIVE use of her name can be cached — "…, Priya." mid-sentence or
/// "Priya, …" opening one. Those two lift straight out for a reader who has no
/// name on file. Any other position has no clean nameless form ("Priya's nights
/// sound hard" would render as "'s nights sound hard"), so such a row is skipped
/// rather than mangled. The prompt asks for the vocative form anyway, so this
/// costs the cache very little.
function stripVocatives(text: string): string {
  const token = escapeRegExp(NAME_TOKEN);
  return (
    text
      // "That sounds rough, {{name}}." / "I hear you — {{name}}, that's a lot."
      // A trailing honorific goes with the name; left behind it would render as
      // "That sounds rough ji." for a reader who has no name on file.
      .replace(
        new RegExp(`\\s*[,—–-]\\s*${token}(?:\\s+(?:ji|beta|dear|aunty))?(?=[\\s.,!?;:]|$)`, 'gi'),
        '',
      )
      // "{{name}}, you're not imagining this." at the start of a sentence. The
      // word that followed her name becomes the sentence opener, so it is
      // recased; a token not followed by a word is left standing, which marks
      // the row uncacheable in templateForCache.
      .replace(
        new RegExp(`(^|[.!?]\\s+)${token}\\s*,\\s*(\\p{L})`, 'gu'),
        (_all, before: string, first: string) => before + first.toUpperCase(),
      )
  );
}

/// Returns the cache-safe form of a reply, or null if it cannot be made safe.
function templateForCache(reply: string, name: string | null): string | null {
  if (!name) return reply;
  const templated = reply.replace(nameMatcher(name), NAME_TOKEN);
  // A form the matcher cannot see — a nickname, or the same name spelled without
  // its accents — would be stored verbatim and shown to someone else. Skip the
  // row instead.
  if (fold(templated).includes(fold(name))) return null;
  // A token left standing after the vocative forms are removed sits somewhere
  // that cannot be un-named. Not cacheable.
  if (stripVocatives(templated).includes(NAME_TOKEN)) return null;
  return templated;
}

/// Renders a stored reply for the woman reading it now. Rows predating the token
/// pass through untouched; for a user with no name the address is lifted out and
/// the sentence closed up, so nothing reads as ", ." or starts mid-case.
function personalize(reply: string, name: string | null): string {
  if (!reply.includes(NAME_TOKEN)) return reply;
  if (name) return reply.split(NAME_TOKEN).join(name);
  return stripVocatives(reply).replace(/\s{2,}/g, ' ').trim();
}

export async function answer(
  userId: string,
  userMessage: string,
  userName?: string | null,
): Promise<AnuChatResponse> {
  const name = sanitizeName(userName);

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
      // The stored row is the templated form; she is recorded and shown the
      // rendered one, so the audit trail holds what she actually read.
      const hitReply = personalize(result.hit.reply, name);
      await recordTurn({
        userId,
        userMessage,
        reply: hitReply,
        suggestions: result.hit.suggestions,
        symptom: result.hit.symptom,
        source: 'cache',
        cacheHitId: result.hit.id,
        similarity: result.hit.similarity,
      });
      return {
        reply: hitReply,
        suggestions: result.hit.suggestions,
        source: 'cache',
        escalation: null,
      };
    }
  }

  // 4. Miss — generate with the thread's context, then remember it if the
  // question stands alone. The near-miss score is stored too, so the threshold
  // can be retuned from what real questions actually scored.
  const generated = await generateReply(userMessage, history, name);
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
    // Stored with her name reduced to a token; null means it could not be made
    // safe to share, and that row is simply skipped.
    const cacheReply = templateForCache(reply, name);
    if (cacheReply) {
      await store(userMessage, cacheReply, suggestions, symptom?.label ?? null, embedding).catch(
        (e) => {
          console.error('[anu] failed to store cache entry', e);
        },
      );
    }
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
