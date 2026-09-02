// The probe ladder.
//
// A short run of questions in front of the classic engine. The point is not the
// questions — it is WHERE THE REASON GOES. Classic answers every message with
// an explanation and some advice, which means it explains "joint pain" before
// knowing when it happens, what came with it, or what changed. The ladder asks
// first and explains once, at the end, with the whole picture.
//
// A conversation runs like this:
//
//   she names a vague complaint  -> authored lead + rung          no model call
//   she names her symptom        -> acknowledgement + rung         1 model call
//   she answers a rung           -> authored ack + next rung      no model call
//   nothing left worth asking    -> traced chain + THE ANSWER      1 model call
//
// **Depth is not five.** It is however many rungs she has not already answered,
// so most conversations run three or four. Her opening message is scanned for
// answers before anything is asked (`prefilledAnswers`); a message that answers
// three of them opens no ladder at all and gets the full answer immediately
// (`MIN_RUNGS`); and the moment she asks for the reason instead of giving
// another answer, the ladder converges with whatever it has
// (`wantsAnswerNow`).
//
// Three properties are worth stating plainly, because they are what makes this
// safe to put in front of a health product:
//
//   The safety gate still runs first, on every turn, and it is NOT reimplemented
//   here — see the delegation below. A ladder that finished its questions before
//   escalating would be the worst thing in this file.
//
//   The rungs are authored text from axes.ts, so the turns carrying most of the
//   conversation cost nothing and cannot drift.
//
//   The ladder abstains rather than guesses. Her own words resolve a rung only
//   when exactly one option matches; anything else is answered as an aside and
//   the rung asked again.

import type { AnuChatResponse } from '@anuva/shared';
import { logger } from '../../logger.js';
import {
  answer as classicAnswer,
  loadAskedQuestions,
  loadHistory,
  recordTurn,
} from '../engine.js';
import { matchRedFlag } from '../redFlags.js';
import { generateReply } from '../openai.js';
import { sanitizeName } from '../prompt.js';
import { findSymptom, findSymptomByKey, followUpChips, logChip } from '../symptoms.js';
import {
  HANDBACK_PROMPT,
  NAMED_ROOT,
  matchOption,
  matchRoot,
  nextUnansweredAxis,
  optionLabels,
  prefilledAnswers,
  questionFor,
  remainingRungs,
  resolveTyped,
  wantsAnswerNow,
  type ProbeAxis,
  type ProbeRoot,
} from './axes.js';
import {
  asideDirective,
  convergeDirective,
  openDirective,
  tracedChain,
  type Answers,
} from './reply.js';
import { ladderRanInThread, loadProbeState, type ProbeState } from './state.js';

const MODE = 'probe' as const;

// As in the classic engine: questions and replies are never logged, only the
// routing decision. Here that includes the rung and the depth, which is the
// metric this feature has to be judged on — how often a ladder that ran to the
// bottom reached the right symptom, and how often she stopped answering.
const log = logger.child({ module: 'anu', engine: 'probe' });

// ---------------------------------------------------------------------------
// Serving a turn
// ---------------------------------------------------------------------------

type LadderTurn = {
  reply: string;
  suggestions: string[];
  source: 'probe' | 'model';
  symptomLabel?: string | null;
  root: ProbeRoot;
  /// The rung offered WITH this reply — so the rung her next message answers.
  /// Null ends the ladder.
  nextAxis: ProbeAxis | null;
  answers: Answers;
  /// Consecutive unresolvable typed messages on the rung being offered. Reset to
  /// zero by any turn that actually advances.
  handbacks?: number;
};

async function serve(
  userId: string,
  userMessage: string,
  turn: LadderTurn,
): Promise<AnuChatResponse> {
  const depth = Object.keys(turn.answers).length;
  await recordTurn({
    userId,
    userMessage,
    reply: turn.reply,
    suggestions: turn.suggestions,
    symptom: turn.symptomLabel ?? null,
    source: turn.source,
    mode: MODE,
    probeRoot: turn.root.key,
    probeAxis: turn.nextAxis,
    probeDepth: depth,
    probeAnswers: turn.answers,
    probeHandbacks: turn.handbacks ?? 0,
  });
  log.info(
    {
      userId,
      source: turn.source,
      root: turn.root.key,
      nextAxis: turn.nextAxis,
      depth,
      remaining: remainingRungs(turn.answers),
      handbacks: turn.handbacks ?? 0,
      symptom: turn.symptomLabel ?? null,
    },
    'ANU probe turn served',
  );
  // A rung is never an escalation. Anything urgent left through the safety gate
  // before the ladder was consulted at all.
  return {
    reply: turn.reply,
    suggestions: turn.suggestions,
    source: turn.source,
    escalation: null,
  };
}

/// A rung she answered that neither ends the ladder nor needs explaining:
/// authored acknowledgement, then the next question. No model call.
function staticRung(
  userId: string,
  userMessage: string,
  root: ProbeRoot,
  symptomLabel: string | null,
  ack: string | undefined,
  answers: Answers,
  nextAxis: ProbeAxis,
): Promise<AnuChatResponse> {
  const question = questionFor(root, nextAxis);
  return serve(userId, userMessage, {
    reply: [ack, question.question].filter(Boolean).join('\n\n'),
    suggestions: optionLabels(question),
    source: 'probe',
    symptomLabel,
    root,
    nextAxis,
    answers,
  });
}

/// The bottom of the ladder — reached when nothing is left worth asking, or when
/// she asks for the reason instead of giving another answer.
///
/// This is the ONLY turn in the flow that explains anything.
async function converge(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  state: ProbeState,
  answers: Answers,
): Promise<AnuChatResponse> {
  const symptomLabel = state.symptomLabel;
  const symptom = findSymptom(symptomLabel);
  // Without a locked symptom there is nothing to converge on. Hand it back
  // rather than write a chain about a symptom nobody established.
  if (!symptomLabel || !symptom) {
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const history = await loadHistory(userId, MODE);
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    true,
    convergeDirective(symptomLabel, answers),
  );

  const asked = [...(await loadAskedQuestions(userId, MODE)), userMessage];
  return serve(userId, userMessage, {
    reply: `${tracedChain(symptomLabel, answers)}\n\n${generated.reply}`,
    // Two follow-ups plus the bank's own log CTA. This is the turn the ladder
    // has been collecting for, and logging it is what turns her answers into a
    // tracker entry and a doctor-prep summary.
    suggestions: [...followUpChips(symptom, asked).slice(0, 2), logChip(symptom)],
    source: 'model',
    symptomLabel,
    root: state.root,
    nextAxis: null,
    answers,
  });
}

/// She typed something the rung could not resolve — a question of her own, an
/// aside, a "not sure". Her message gets answered, and the rung is re-offered
/// underneath it so the ladder is still there if she wants it.
///
/// Once. A second unresolvable message ends the ladder: by then she has said
/// twice over that she would rather talk than tap, and repeating the question a
/// third time would be badgering her.
async function aside(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  state: ProbeState,
): Promise<AnuChatResponse> {
  const handbacks = state.handbacks + 1;
  if (handbacks > 1) {
    log.info(
      { userId, root: state.root.key, axis: state.axis, handbacks },
      'Probe ladder abandoned — she is answering in her own words',
    );
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const question = questionFor(state.root, state.axis);
  const history = await loadHistory(userId, MODE);
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    true,
    asideDirective(question.question),
  );

  return serve(userId, userMessage, {
    reply: `${generated.reply}\n\n${question.question}`,
    suggestions: optionLabels(question),
    source: 'model',
    symptomLabel: state.symptomLabel,
    root: state.root,
    // The SAME rung — it is still unanswered.
    nextAxis: state.axis,
    answers: state.answers,
    handbacks,
  });
}

// ---------------------------------------------------------------------------
// Opening a ladder
// ---------------------------------------------------------------------------

/// A vague complaint — "body pain", "not feeling myself". The location rung has
/// to narrow it, and the authored lead means this turn costs nothing at all.
function openVague(
  userId: string,
  userMessage: string,
  root: ProbeRoot,
  answers: Answers,
): Promise<AnuChatResponse> {
  const question = questionFor(root, 'location');
  return serve(userId, userMessage, {
    reply: `${root.lead}\n\n${question.question}`,
    suggestions: optionLabels(question),
    source: 'probe',
    root,
    nextAxis: 'location',
    answers,
  });
}

/// She named her own symptom, so the location rung is already answered and the
/// ladder starts further down — this is where three- and four-rung conversations
/// come from.
///
/// The one model call here is acknowledgement ONLY (see openDirective). It also
/// does the symptom classification, so identifying the symptom costs no extra
/// call: the model already returns a bank label with every reply.
async function openNamed(
  userId: string,
  userMessage: string,
  userName: string | null | undefined,
  prefilled: Answers,
): Promise<AnuChatResponse> {
  const history = await loadHistory(userId, MODE);
  const generated = await generateReply(
    userMessage,
    history,
    sanitizeName(userName),
    true,
    openDirective(),
  );
  const symptom = findSymptom(generated.symptom);

  // A greeting, small talk, or something declined. The acknowledgement IS the
  // whole reply — no rung, no chips, no ladder.
  if (!symptom) {
    return serve(userId, userMessage, {
      reply: generated.reply,
      suggestions: [],
      source: 'model',
      root: NAMED_ROOT,
      nextAxis: null,
      answers: {},
    });
  }

  const answers: Answers = { location: symptom.label.toLowerCase(), ...prefilled };
  const nextAxis = nextUnansweredAxis(answers);
  const question = nextAxis ? questionFor(NAMED_ROOT, nextAxis) : null;

  return serve(userId, userMessage, {
    reply: question ? `${generated.reply}\n\n${question.question}` : generated.reply,
    suggestions: question ? optionLabels(question) : [],
    source: 'model',
    symptomLabel: symptom.label,
    root: NAMED_ROOT,
    nextAxis,
    answers,
  });
}

// ---------------------------------------------------------------------------

export async function answer(
  userId: string,
  userMessage: string,
  userName?: string | null,
): Promise<AnuChatResponse> {
  // 1. Safety gate. Delegated rather than reimplemented: the clinician-authored
  // reply, its helplines and its audit row must have exactly ONE implementation,
  // and a second copy of this block is the kind of drift that ends up serving a
  // crisis message without a helpline number. The cost is one more pass over
  // ten regexes.
  if (matchRedFlag(userMessage)) {
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  const state = await loadProbeState(userId);

  if (state) {
    // 2. She has stopped answering and started asking. Give her the answer with
    // what is already known rather than finishing the list first — this is the
    // difference between a companion and a form.
    if (wantsAnswerNow(userMessage)) {
      log.info(
        { userId, root: state.root.key, axis: state.axis, depth: Object.keys(state.answers).length },
        'Probe ladder converging early — she asked for the answer',
      );
      return converge(userId, userMessage, userName, state, state.answers);
    }

    // 3. A rung is pending. A tapped chip answers it; so does the same thing in
    // her own words. Only the second can abstain.
    const question = questionFor(state.root, state.axis);
    const tapped = matchOption(question, userMessage);
    const option = tapped ?? resolveTyped(question, userMessage);
    if (!option) {
      return aside(userId, userMessage, userName, state);
    }

    const answers: Answers = { ...state.answers, [state.axis]: option.tag };
    let symptomLabel = state.symptomLabel;

    if (state.axis === 'location') {
      const symptom = findSymptomByKey(option.symptomKey);
      if (!symptom) {
        // "Somewhere else" / "Something else". The ladder has nothing to offer
        // her and must not pretend otherwise, so it ends and asks for her own
        // words — which the classic engine routes on the next turn.
        return serve(userId, userMessage, {
          reply: HANDBACK_PROMPT,
          suggestions: [],
          source: 'probe',
          root: state.root,
          nextAxis: null,
          answers,
        });
      }
      symptomLabel = symptom.label;
      answers.location = option.tag;
    }

    // A typed answer often answers more than the rung that was asked. "Mornings,
    // and my sleep is shot too" is two rungs, and asking the second one back
    // would read as not having listened.
    if (!tapped) Object.assign(answers, { ...prefilledAnswers(state.root, userMessage), ...answers });

    const nextAxis = nextUnansweredAxis(answers);
    if (!nextAxis) {
      return converge(userId, userMessage, userName, { ...state, symptomLabel }, answers);
    }
    return staticRung(userId, userMessage, state.root, symptomLabel, option.ack, answers, nextAxis);
  }

  // 4. One ladder per thread. Once it has closed, every later message is a
  // follow-up and a follow-up wants an ANSWER — meeting "why does this happen?"
  // with a fresh round of questions is the exact failure this is built to
  // remove.
  if (await ladderRanInThread(userId)) {
    return classicAnswer(userId, userMessage, userName, MODE);
  }

  // 5. A vague complaint needs the location rung; anything else has already
  // named its own symptom, so its ladder starts at the timing rung — which is
  // where three- and four-rung conversations come from.
  const root = matchRoot(userMessage);
  if (root) {
    return openVague(userId, userMessage, root, prefilledAnswers(root, userMessage));
  }
  return openNamed(userId, userMessage, userName, prefilledAnswers(NAMED_ROOT, userMessage));
}
