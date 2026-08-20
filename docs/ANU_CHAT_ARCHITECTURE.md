# ANU Chat Architecture

## Phase 1 Scope

ANU answers perimenopause questions from a **clinician-approved Q&A bank**, not from a language model. The bank is authored in a workbook (`Anuva_ANU_AI_Perimenopause_QA_Bank`), reviewed and signed off by a gynecologist and a psychologist, and imported into Postgres. At runtime the system decides *which approved answer applies* and serves it **verbatim**. It never writes clinical text.

The user-visible behaviour is a chat. The machinery underneath is a router plus a state machine.

Phase 1 does not include generative answering, multilingual variants, or personalization from tracker history. Those are addressed under [Deliberately Excluded](#deliberately-excluded) and [Later Phases](#later-phases).

## Why Not RAG

The obvious design for "chat over a Q&A bank" is retrieval-augmented generation: retrieve relevant rows, hand them to an LLM, let it compose an answer. That is the wrong architecture here, for two reasons.

**The content is signed.** Every answer carries a `Review Status`, because a clinician has to sign off on an exact string. Generation-at-request-time means the text that reaches the user was composed at request time and reviewed by nobody — the artifact that was approved and the artifact that was delivered are different objects. No prompt fixes that. In a health product aimed at symptomatic women, that gap is the whole risk.

**The bank is not a corpus.** It only looks like one. Its actual structure is a routing table welded to a fixed dialogue script (see below). RAG would dissolve that structure into chunks and then pay a language model to approximately reconstruct it. Retrieval is genuinely needed for exactly one decision — *which symptom is the user describing* — and nothing after that decision requires a model at all.

So: retrieval, yes. Generation of clinical content, never.

## The Q&A Bank

40 symptoms × 5 rows = 200 rows at V1, growing toward ~3,000. The five rows per symptom are **not five independent FAQs**. They are one conversation arc, and it is identical for all 40 symptoms — verified: a single intent sequence, zero deviations.

| Stage | Intent |
|---|---|
| `lead` | Validate + explain + log symptom |
| `why` | Education / why it happens |
| `triggers` | Trigger discovery |
| `self_care` | Immediate self-care / safe action |
| `escalation` | Escalation / doctor-prep |

Three consequences drive the whole design:

- **Only `lead` rows are retrieval targets.** Once a symptom is identified, the next four turns are *traversal*, not search. The `ANU Follow-up Prompt` column is literally the next-turn CTA.
- **This is fortunate, because lead rows are the distinctive ones.** Measured across the bank, `lead` answers are ~0.36 pairwise-similar while follow-ups run ~0.70 — the follow-ups are heavily templated from a shared skeleton. Retrieving over follow-ups would be near-impossible. We never do.
- **`Symptom Category` is useless for routing.** The bank uses 25 categories for 40 symptoms, 14 of which contain exactly one symptom (`Hair symptoms`, `Nail symptoms`, `Sexual health` vs `Sexual & vaginal health` vs `Sexual & pelvic health`…). It is nearly 1:1 with symptom. Do not build hierarchical category→symptom routing; it buys nothing. Route straight to symptom. Category stays as a display/reporting field only.

**Red-flag level is a property of the symptom, not of the stage.** Of the 200 rows, 40 are `High if red flags present` — and those are 8 symptoms whose *five rows all* carry it, not one escalation row per symptom. So the moment the router locks a symptom, its escalation tier is already known.

## Components

- `apps/api`: Owns the safety gate, the router, conversation state, and the audit log. Serves approved answers. Never calls an LLM to produce clinical text.
- `apps/pwa`: Renders the chat. Renders follow-up prompts as **tap-able chips**, not free text.
- `apps/admin`: Content review console — clinicians approve, reject, or request rewrites; ops triage the content gap log.
- `packages/database`: Stores the bank, its embeddings, red-flag rules, conversation state, and the served-answer audit trail.
- `packages/shared`: Zod schemas for chat turns and router responses.
- Embedding model: `bge-small-en-v1.5` (33M params, 384-dim), int8 via ONNX Runtime, in-process on the API. ~10 ms and ~50 MB per query. No GPU, no model server, no separate inference process.
- Postgres + `pgvector`: Vector storage and exact nearest-neighbour scan.

## Request Pipeline

Four layers. Each can short-circuit the ones below it.

### Layer 0 — Safety gate

Runs on **every turn, before anything else**. Sourced from the workbook's `Red Flags` sheet (10 rules at V1). Deterministic: phrase and pattern matching, plus a small classifier. Emits the rule's `ANU Safety Response` **verbatim** and halts the pipeline.

Tuned for **recall, not precision**. A false positive tells a woman to see a gynecologist she didn't strictly need to see — an annoyance. A false negative is the failure that ends the company.

**The self-harm rule is not like the others.** `"I feel unsafe, hopeless, or like harming myself"` (Urgent) must not route to a booking flow. It routes to a crisis response with live helpline numbers (India: Tele-MANAS **14416**, iCall, AASRA). This is the single most safety-critical path in the product and gets the most test coverage. Note that `Mood & emotional symptoms` is the *largest* category in the bank (4 symptoms, 20 rows) — mental health is a primary surface here, not an edge case.

### Layer 1 — Symptom router

Answers the only retrieval question in the system: which symptom is this? Runs on the **first message of a thread only** — after that, chips drive traversal, so the router is off the hot path for most turns.

**Index-time paraphrase expansion.** Content writers do not phrase things the way users do, and that mismatch — not the ranking function — is the real source of routing error. So for every `lead` row we generate 5–10 paraphrases offline ("I'm drenched at night", "waking up soaked", "sweating through my sheets") and embed all of them. A symptom matches if *any* of its variants matches. This moves the intelligence into a cheap offline artifact and costs nothing at runtime.

**Hybrid retrieval.** Dense vector search catches paraphrase; Postgres full-text search (`tsvector`) catches exact clinical terms that embeddings blur together — "night sweats" and "hot flashes" are semantically adjacent and embeddings will happily confuse them. Fuse the two ranked lists with Reciprocal Rank Fusion.

**No reranker.** A cross-encoder over the top-k would cost 300–800 ms of CPU and contend with LiveKit Egress during consultation calls (see `CONSULTATION_CALLS_ARCHITECTURE.md`). It is also the wrong tool: a reranker can only reorder what retrieval already found, whereas paraphrase expansion fixes recall at the source. Close calls are resolved by asking, not by ranking harder.

**Abstain aggressively.** Score on both absolute similarity and the *margin* between top-1 and top-2:

| Outcome | Action |
|---|---|
| Clear winner | Serve the approved `lead` answer. Enter the state machine. |
| Close call | Ask one disambiguating question. Do not guess. |
| Nothing close | Decline honestly. Log the gap. |

Once every answer is clinician-approved, **mis-routing becomes the only remaining clinical risk** — an approved answer served for the wrong symptom carries full clinical authority, which is worse than serving nothing. Abstaining is cheap; guessing is not. Asking one question per turn is also what the workbook's own `Conversation Logic` sheet prescribes.

### Layer 2 — Conversation state machine

The session holds `{symptomId, stage}`. Serve the approved answer for the current stage; render the `ANU Follow-up Prompt` as a chip. On tap, advance. No embedding, no search, no model — a lookup and a counter.

Each turn logs to the symptom's `Tracker Field` and `Severity Scale` (from the `Symptom Map` sheet), feeding the existing symptom tracker. `Recommended Specialist` drives the booking handoff. `Family Nudge` is offered **only with explicit opt-in** — never share health details with family without consent.

### Layer 3 — Honest decline

There is no generative fallback. If the bank cannot answer, ANU says so:

> "I don't have a reliable answer for that yet. Would you like to log it, or book a consultation?"

This follows directly from the approved-content policy — an LLM composing an answer for an out-of-bank question produces text no clinician signed. In a health product, "I don't know yet" is a feature. Every declined message lands in the content gap log, which is how the bank grows from 200 rows to 3,000 **in the order users actually need**.

## Warmth: Generated Envelope, Approved Core

Strictly read, the approved-content policy also forbids an LLM *rephrasing* an approved answer for tone — if a model rewrites the string, the string the user sees was not the string that was approved. But answers served verbatim in sequence read robotically, especially the follow-ups (which are ~0.70 similar to each other by construction).

Resolve this by separating the two physically:

- **Envelope** — generated, non-clinical. One opening line reflecting what the user actually typed; transitions; references to the user's own tracker data. Contains zero medical claims.
- **Core** — approved, verbatim, untouched. The `ANU Answer` and its `ANU Follow-up Prompt`. **Never passed through a model.**

This is a hard boundary in code, not a prompt instruction. The approved payload is concatenated, never transformed. It buys warmth without putting a clinician's signature on text they did not write.

## Data Model

Follows existing schema conventions (cuid ids, lowercase enum members).

```prisma
enum AnuQaStage {
  lead
  why
  triggers
  self_care
  escalation
}

enum AnuReviewStatus {
  needs_review
  approved
  needs_rewrite
  rejected
}

enum AnuRedFlagLevel {
  none
  conditional
  high
}

enum AnuRedFlagUrgency {
  urgent
  same_day
  prompt_review
  conditional
}

model AnuSymptom {
  id                    String            @id @default(cuid())
  key                   String            @unique // "S05"
  label                 String // "Night sweats"
  category              String // display only — NOT a routing tier
  primaryComplaint      String
  trackerFields         String
  severityScale         String
  redFlagLevel          AnuRedFlagLevel
  recommendedSpecialist String
  familyNudge           String
  sourceTag             String
  active                Boolean           @default(true)
  entries               AnuQaEntry[]
}

model AnuQaEntry {
  id                String            @id @default(cuid())
  questionId        String            @unique // "S05-Q01"
  symptomId         String
  symptom           AnuSymptom        @relation(fields: [symptomId], references: [id], onDelete: Cascade)
  stage             AnuQaStage
  intent            String
  userQuestion      String
  answer            String            @db.Text // served verbatim — never model-transformed
  followUpPrompt    String
  escalationAdvice  String            @db.Text

  // Review is enforced in the query, not just recorded here.
  reviewStatus      AnuReviewStatus   @default(needs_review)
  reviewedBy        String?
  reviewedAt        DateTime?
  version           Int               @default(1)

  languageVariant   String            @default("en")
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  embeddings        AnuQaEmbedding[]
  servedTurns       AnuChatTurn[]

  @@unique([symptomId, stage, languageVariant, version])
  @@index([reviewStatus])
}

/// One row per paraphrase variant. Only `lead` entries are embedded —
/// follow-ups are traversed, never retrieved.
model AnuQaEmbedding {
  id        String                @id @default(cuid())
  entryId   String
  entry     AnuQaEntry            @relation(fields: [entryId], references: [id], onDelete: Cascade)
  variant   String // the paraphrase text
  isCanonic Boolean               @default(false) // true = the authored `userQuestion`
  embedding Unsupported("vector(384)")

  @@index([entryId])
}

model AnuRedFlagRule {
  id                    String            @id @default(cuid())
  area                  String // "Bleeding", "Mental health"
  pattern               String            @db.Text
  safetyResponse        String            @db.Text // emitted verbatim
  urgency               AnuRedFlagUrgency
  recommendedSpecialist String
  isCrisis              Boolean           @default(false) // self-harm → helplines, not booking
  active                Boolean           @default(true)
}

model AnuChatSession {
  id          String      @id @default(cuid())
  userId      String
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  symptomId   String?
  symptom     AnuSymptom? @relation(fields: [symptomId], references: [id])
  stage       AnuQaStage?
  startedAt   DateTime    @default(now())
  lastTurnAt  DateTime    @updatedAt
  turns       AnuChatTurn[]

  @@index([userId])
}

/// Immutable audit trail. Records exactly which answer version was shown
/// to which user, when. Required to reconstruct what a user was told.
model AnuChatTurn {
  id              String          @id @default(cuid())
  sessionId       String
  session         AnuChatSession  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  userMessage     String          @db.Text
  entryId         String?
  entry           AnuQaEntry?     @relation(fields: [entryId], references: [id])
  entryVersion    Int?
  servedAnswer    String          @db.Text // snapshot of what was actually rendered
  redFlagRuleId   String?
  routerScore     Float?
  routerMargin    Float?
  abstained       Boolean         @default(false)
  createdAt       DateTime        @default(now())

  @@index([sessionId])
  @@index([createdAt])
}

/// Every question the bank could not answer. This is the content roadmap.
model AnuContentGap {
  id            String   @id @default(cuid())
  userMessage   String   @db.Text
  topCandidates Json // [{ symptomKey, score }] — what the router *almost* matched
  occurrences   Int      @default(1)
  resolvedBy    String? // AnuQaEntry.questionId once authored
  createdAt     DateTime @default(now())

  @@index([resolvedBy])
}
```

### Why the audit trail is a snapshot, not a join

`AnuChatTurn.servedAnswer` duplicates text that also lives in `AnuQaEntry.answer`. That is deliberate. Answers get revised and re-approved; a join would show what the entry says *today*, not what the user was told *then*. For a health product you may need to reconstruct exactly what a woman was shown on a given date — for your own incident review long before anyone else asks.

## Content Review

**Only `reviewStatus = approved` rows are servable.** This is enforced in the router's query, not by convention — an unapproved row is invisible to retrieval, full stop. A row that fails review simply cannot reach a user.

At 3,000 rows, review is a **pipeline, not a milestone**:

- **Prioritize the queue by traffic, not row order.** The gap log and routing frequencies tell you which entries users actually hit. A clinician-hour spent on the top 50 is worth more than one spent on entry 2,847.
- **Review the 8 high-red-flag symptoms and the crisis path first**, with the psychologist. Those are the ones where being wrong is unrecoverable.
- **Versioning is not optional.** Answers will be revised post-launch. Bump `version`, keep the old row, and let the audit trail point at the version that was actually served.

## Product Guardrail

From the workbook's Dashboard, and binding on every layer:

> ANU should never diagnose, prescribe, adjust medicines, interpret labs as final diagnosis, or share health information with family without explicit consent. It should validate, explain, track, detect red flags, and navigate the user to qualified care.

## Deliberately Excluded

- **Generative clinical answers.** Incompatible with approved-content-only. See Layer 3.
- **A reranker.** Wrong tool, and 300–800 ms of CPU we don't have.
- **A vector database.** See below.
- **A self-hosted LLM.** Nothing in the answer path needs one.

## Scaling Notes

At 3,000 bank entries with 8 paraphrase variants each, the index is 24,000 vectors:

```
24,000 × 384 dims × 4 bytes ≈ 37 MB
```

An exhaustive cosine scan is ~9M multiply-adds — single-digit milliseconds. **Do not add an ANN index and do not add a vector database.** `pgvector` doing an exact sequential scan is comfortable well past 100k rows, and exact search means no recall cliff to tune. Revisit only if the bank passes ~100k vectors.

Per routed turn:

| Step | Cost |
|---|---|
| Embed user message (`bge-small`, int8, ONNX) | ~10 ms, 1 thread, ~50 MB RSS |
| Dense scan, 24k vectors | ~3–5 ms |
| Postgres full-text scan | ~5 ms |
| RRF fusion + thresholding | negligible |

**~20 ms on one core, and only on the first turn of a thread** — chips carry every turn after that. This coexists comfortably with the LiveKit SFU and Egress workers on the same box; unlike a reranker or a local LLM, it will not contend for cores during a consultation call.

The only outbound model calls are the optional envelope generation and ambiguity tie-breaks, both of which are low-volume API calls and neither of which touches clinical text.

## Later Phases

- **Hinglish and regional variants.** `languageVariant` is in the schema from day one, but the workbook is explicit: language variants come *after* clinical approval of the English bank. Multilingual routing needs a multilingual embedding model (`multilingual-e5-small`) — the router must be re-evaluated, not just re-indexed.
- **Personalization from tracker history.** Lives in the envelope, never the core.
- **User testing.** The workbook prescribes 20–30 perimenopause users for clarity, comfort, and trust. Automated routing accuracy is necessary but not sufficient.

## Evaluation

The router is the whole ballgame — everything downstream is a lookup, and mis-routing is the only clinical risk left once content is approved. Before shipping, build a held-out set of 5–10 paraphrases per symptom and track:

- **Top-1 accuracy** — did it pick the right symptom?
- **Abstain rate and abstain precision** — when it declined, *should* it have?
- **Red-flag recall** — must be the number you defend hardest. Measure it separately, on adversarial phrasings, including obliquely-worded self-harm.

Re-run all three every time the bank grows. Adding 2,800 rows can quietly make routing *worse*, and this eval is the only thing that will tell you.
