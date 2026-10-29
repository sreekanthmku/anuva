# ANU Probe Ladder

A short run of questions in front of the chat engine. **On by default** —
`ANU_CHAT_MODE=classic` turns it off.

## The problem it solves

The point is not the questions. It is **where the reason goes**.

The classic engine answers every message with an explanation and some advice. So
"Joint pain" gets the hormonal cause, a differential, and two things to try —
before anything is known about when it happens, what came with it, or what
changed. Then the next message gets another explanation, and another. Every turn
is a small lecture, and none of them is informed by the one before.

```
she:  Joint pain
ANU:  It can be tied to hormone changes during perimenopause, leading to
      inflammation and discomfort. Other causes might include stress, not
      enough movement... How long has this been going on?
she:  One week
ANU:  Keep an eye on it. In the meantime, gentle movement can help, and a warm
      compress might ease the ache. How has it been affecting your daily...
```

Two explanations, two pieces of generic advice, and the second one is no better
informed than the first. "Gentle movement" and "stay hydrated" are on the
prompt's own banned list precisely because they fit any woman with any symptom.

The ladder asks first and explains **once**, at the end, with the whole picture.

## The five whys are the system's, not hers

Root-cause analysis on a machine asks "why?" five times. Asking a woman in pain
"why do you think that happens?" five times reads as interrogation, and she is
asking precisely *because* she does not know. So each internal why surfaces as
one concrete question about something she can observe:

| Internal why | Axis | Resolves |
|---|---|---|
| Why this pain? | `location` | vague complaint → one of the forty symptoms |
| Why now? | `timing` | hormonal-cyclical vs mechanical |
| Why this cluster? | `cluster` | the perimenopause pattern, or something else |
| Why still? | `context` | the modifiable driver |
| Why it matters | `impact` | severity, and the care lane |

## Depth is not five

It is however many rungs she has not already answered — so most conversations
run **three or four**, and the number moves with what she says.

- **A vague complaint** ("body pain", "not feeling myself") needs the location
  rung to narrow it: 3–5 rungs.
- **A named symptom** ("Joint pain", "I can't sleep") has already answered
  location, so the ladder starts at timing: 2–4 rungs.
- **Her opening sentence is scanned for answers** before anything is asked. "My
  knees are stiff every morning and my periods have changed" answers timing and
  cluster too — two rungs left, not four.
- **A typed answer often answers more than the rung asked.** "Mornings mostly,
  and my periods have changed too" advances two at once.
- **The moment she asks for the reason instead of giving another answer** — "why
  does this happen?", "just tell me", "should I see a doctor" — the ladder
  converges with whatever it has. She stopped answering and started asking;
  finishing the list first is what makes a companion feel like a form.

Only `timing` and `cluster` can be filled from a passing mention.
`context` ("has anything shifted?") and `impact` ("what's it stopping you
doing?") are judgements she has to actually make — "work has been stressful" is
not her saying the pain stops her working, and recording it as though it were
would put words in her mouth and then reason from them. `location` is excluded
for a harder reason: it *is* the symptom, and a wrong one carries the full
authority of a right one.

## How a conversation runs

```
she names a vague complaint  -> authored lead + rung          no model call
she names her symptom        -> acknowledgement + rung         1 model call
she answers a rung           -> authored ack + next rung      no model call
nothing left worth asking    -> traced chain + THE ANSWER      1 model call
```

A full vague ladder is **six turns and one completion** — and the completion is
the closing one. A named-symptom ladder is two. Both are cheaper than classic,
which pays for a completion or a cache lookup on every single turn.

**One ladder per thread.** Once it closes, every later message is a follow-up,
and a follow-up wants an answer. Meeting "why does this happen?" with a second
round of questions would be the exact failure this was built to remove.

## She types more often than she taps

A rung is offered as chips, but nothing makes her use them, and "mostly my knees"
is an answer to the question — not a change of subject. Each option carries
authored `match` patterns for how a woman actually says it, and `resolveTyped`
maps her words onto one. Patterns rather than a model call, for the reason
`redFlags.ts` is: the decision has to be reviewable and identical every time.

**It abstains unless exactly one option matches.** "My neck and my knees" covers
two, so the rung is asked again rather than assigned to whichever is declared
first. The one option with no patterns at all is "Somewhere else" — the way out
has to be chosen deliberately, never inferred from words that matched nothing.

## When she says something else

An aside ("wait, is this permanent?"), a question of her own, a "not sure" — her
message gets answered in full, and **the rung is repeated underneath it with its
chips still offered**. The ladder does not die because she asked something.

Once. A second unresolvable message ends it: by then she has said twice over that
she would rather talk than tap. `AnuChatTurn.probeHandbacks` counts the run, and
any rung she actually answers resets it.

A red flag ends the ladder immediately. Picking back up with "has anything else
turned up around the same months?" after a crisis reply would be grotesque.

## The closing turn

The chain is printed from her own answers, above the generated explanation:

> Here's the thread we pulled together: joint pain, worst in the mornings,
> alongside broken sleep, with more stress in the mix — and it's landing on
> everyday things.

It is assembled entirely from the bank's symptom label and the `tag` of each
option she chose — nothing in it is generated, which is why it may state a
pattern at all. It is still an **envelope, not a finding**: it says what was
traced, never what causes what, and `convergeDirective` bars the model from
claiming otherwise. ANU never diagnoses.

The same answers map onto the tracker's own fields and print as a doctor-prep
summary. Three taps become a structured record, not just a better-routed reply.

## Tone

The generated turns use the same system prompt, few-shot and voice rules as
classic. What the ladder adds is **authored** prose — three leads, eight
questions, thirty-odd acknowledgements — and `prompt.ts` governs none of it,
because none of it passes through a model.

`anu-probe-voice.test.ts` closes that gap, holding every authored string to the
prompt's own rules: no wellness filler ("stay hydrated", "gentle movement"), no
clinical register, no borrowed experience ("I know how that feels"), no bullets
or headings, contractions rather than formal forms, every lead speaking to *her*.

Two rules specific to the ladder, both enforced by that file:

- **An acknowledgement acknowledges. It does not explain.** No mechanism, no
  cause, no advice — "hormonal", "inflammation", "because", "can help" are all
  banned from authored strings. Explaining a little on every rung is what turns
  the flow into a lecture with questions bolted on, and it spends the payoff
  before there is anything to reason from.
- **No house phrases.** "You're not imagining this" is the model's to reach for
  when she sounds dismissed. Baked into a static lead it would fire on every
  opener of that shape, and collide with the model's own use of it later.

`openDirective` states the ban four separate ways, because explaining is exactly
what the system prompt spends three sections teaching.

**The honest residual risk:** the ladder asks a question on every turn, and
`prompt.ts` forbids the model from doing that ("NEVER two turns running"). Every
rung answering before it asks, adaptive depth, converging when she asks, and
answering her asides all pull against it — but nothing makes four questions in a
row not feel like four questions. User testing has to answer that, not code.

## Rules that keep it safe

1. **The safety gate runs first, on every turn.** Delegated to the classic engine
   rather than reimplemented — the clinician-authored reply, its helplines and its
   audit row must have exactly one implementation.
2. **A red flag mid-ladder abandons the ladder.** Nothing more is asked.
3. **The ladder abstains rather than guesses**, and never fills the rungs she has
   to judge for herself.
4. **The location rung always offers one way out** for a complaint it cannot
   place.
5. **No model writes a question.** A generated chip once came back as "Could it
   be my thyroid?"; a generated *question* can plant a self-diagnosis as easily
   as an answer can.

## Rollout

`apps/api/src/anu/index.ts` is the only switch point; `chatMode()` decides per
user.

| Variable | Effect |
|---|---|
| *unset* | **the ladder** — this is the default engine |
| `ANU_CHAT_MODE=classic` | ladder off for everyone |
| `ANU_PROBE_USER_IDS` | forces the ladder ON for these users, even when the mode is classic |
| `ANU_PROBE_PERCENT` | forces the ladder ON for this share of users, bucketed by a stable hash of the user id |

Only the exact string `classic` turns the ladder off. An absent, empty or
misspelled value leaves it on, so a typo in a deploy config cannot quietly revert
the product to the old engine.

The two probe knobs exist for a staged **rollback**: turn the ladder off
globally, keep it on for a slice, and compare the two engines on the same
traffic. Buckets are a stable hash of the user id, so nobody gets the ladder on
Monday and classic on Tuesday.

`AnuChatTurn.mode` is also the thread boundary — flipping the rollout
mid-conversation would otherwise leave one engine continuing from a question the
other asked. Rows written before this feature are backfilled to `classic`.

## Still open before launch

- **Every string in `axes.ts` needs clinician sign-off.** A question put to a
  symptomatic woman is content she reads; it belongs next to `redFlags.ts` in the
  review queue. The voice test covers register — it says nothing about whether a
  question is clinically the right one to ask.
- **Ladder resolution rate**: of vague openers, what fraction reach the right
  symptom, and how often it is wrong. Weight the second heavily — a woman who has
  answered four questions will trust the closing answer more than a one-shot
  reply, so a mis-route at the bottom costs more than one at the top.
- **Abandonment per rung.** If she drops out at rung three, the ladder has spent
  her patience and given her a worse answer than classic would have.
- **Whether the acknowledgement-only opening turn feels warm or withholding.**
  It is the one turn where the ladder deliberately gives less than classic did.

## v1 limitations, deliberately

- Every `location` option maps to exactly **one** symptom, so that rung either
  locks or exits. A "narrow to three, then keep asking" version needs a candidate
  set in the state, and is not worth it until the resolution numbers say so.
- A named symptom gets the general timing rung, not one written for its own
  symptom. Fine for the forty as a set; the joint-pain-specific "stiff for 30+
  minutes" distinction is a later phase.
- Typed answers are matched by authored patterns, so a phrasing nobody thought of
  becomes an aside rather than an answer. That fails in the safe direction — she
  gets a real reply and the question again — and the fix is to add the phrasing.
- If the opening turn's model call returns no symptom for a message that really
  is one, she gets a bare acknowledgement and has to say more. Rare, given the
  prompt's own rule that anything describing how she feels is a symptom.
