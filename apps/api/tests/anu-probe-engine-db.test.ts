import { beforeEach, describe, expect, it, vi } from 'vitest';

// The whole ladder, walked turn by turn. The rungs themselves are pure and
// covered in anu-probe-axes.test.ts; what is exercised here is the part that
// only shows up in sequence — where state is picked up from, which turns spend
// a model call and which do not, and what happens when she stops tapping.
//
// Prisma is an in-memory stand-in for AnuChatTurn, matching only the three
// queries the engines actually issue. The model and the response cache are
// stubbed: this test is about routing, not wording.

type TurnRow = {
  id: string;
  userId: string;
  userMessage: string;
  reply: string;
  suggestions: string[];
  symptom: string | null;
  source: string;
  mode: string;
  probeRoot: string | null;
  probeAxis: string | null;
  probeDepth: number | null;
  probeAnswers: Record<string, string> | null;
  probeHandbacks: number | null;
  createdAt: Date;
};

const rows: TurnRow[] = [];

type Where = {
  userId?: string;
  mode?: string;
  createdAt?: { gte?: Date };
  probeAxis?: { not: null };
  source?: { not: string };
};

/// Narrow on purpose — it handles exactly the clauses loadProbeState,
/// loadHistory and loadAskedQuestions use, and nothing else.
function selectRows(args: { where?: Where; take?: number }): TurnRow[] {
  const where = args.where ?? {};
  const matched = rows
    .filter((row) => (where.userId === undefined ? true : row.userId === where.userId))
    .filter((row) => (where.mode === undefined ? true : row.mode === where.mode))
    .filter((row) => (where.createdAt?.gte ? row.createdAt >= where.createdAt.gte : true))
    .filter((row) => (where.probeAxis ? row.probeAxis !== null : true))
    .filter((row) => (where.source ? row.source !== where.source.not : true))
    // Every query here orders newest first.
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return args.take ? matched.slice(0, args.take) : matched;
}

const mocks = vi.hoisted(() => ({
  generateReply: vi.fn(async () => ({ reply: '<<generated>>', symptom: null as string | null })),
  embedQuestion: vi.fn(async () => new Float32Array(512)),
  lookup: vi.fn(async () => ({ hit: null, bestScore: 0.1 })),
  store: vi.fn(async () => undefined),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    anuChatTurn: {
      findFirst: async (args: { where?: Where }) => selectRows(args)[0] ?? null,
      findMany: async (args: { where?: Where; take?: number }) => selectRows(args),
      create: async ({ data }: { data: Partial<TurnRow> }) => {
        const row: TurnRow = {
          id: `turn_${rows.length}`,
          userId: data.userId!,
          userMessage: data.userMessage ?? '',
          reply: data.reply ?? '',
          suggestions: data.suggestions ?? [],
          symptom: data.symptom ?? null,
          source: data.source ?? 'model',
          mode: data.mode ?? 'classic',
          probeRoot: data.probeRoot ?? null,
          probeAxis: data.probeAxis ?? null,
          probeDepth: data.probeDepth ?? null,
          probeAnswers: data.probeAnswers ?? null,
          probeHandbacks: data.probeHandbacks ?? null,
          // Monotonic, so ordering is deterministic without sleeping.
          createdAt: new Date(Date.now() + rows.length),
        };
        rows.push(row);
        return row;
      },
    },
  },
}));

vi.mock('../src/anu/openai.js', () => ({
  EMBED_DIMENSIONS: 512,
  isAnuChatConfigured: () => true,
  generateReply: mocks.generateReply,
  embedQuestion: mocks.embedQuestion,
}));

vi.mock('../src/anu/cache.js', () => ({
  lookup: mocks.lookup,
  store: mocks.store,
  loadCache: async () => 0,
  cacheStats: () => ({ entries: 0 }),
}));

const { answer } = await import('../src/anu/probe/engine.js');

const USER = 'user_probe';

/// The chip she taps at each rung, in order.
const TAPS = [
  'Joints — knees, fingers, wrists',
  'Mornings — stiff for a while',
  'Sleep is broken',
  'More stress than usual',
  'Stairs, chores, everyday things',
];

function lastTurn(): TurnRow {
  return rows[rows.length - 1]!;
}

beforeEach(() => {
  rows.length = 0;
  vi.clearAllMocks();
});

describe('entering the ladder', () => {
  it('asks the first rung for a vague opener, with no model call', async () => {
    const res = await answer(USER, 'feeling body pain');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('Where does it sit most?');
    expect(res.suggestions).toContain('Joints — knees, fingers, wrists');
    expect(res.escalation).toBeNull();
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn()).toMatchObject({ mode: 'probe', probeAxis: 'location', probeDepth: 0 });
  });

  it('leaves an opener that already names a symptom to the classic engine', async () => {
    const res = await answer(USER, 'my joint pain is bad today');

    expect(res.source).toBe('model');
    expect(mocks.generateReply).toHaveBeenCalledTimes(1);
    // The classic engine passes no directive at all — this turn went through
    // it untouched.
    expect(mocks.generateReply.mock.calls[0]![4]).toBeUndefined();
    expect(lastTurn().probeAxis).toBeNull();
  });
});

describe('walking the ladder', () => {
  it('locks the symptom from her tap and answers it in full', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, TAPS[0]!);

    expect(res.source).toBe('model');
    expect(mocks.generateReply).toHaveBeenCalledTimes(1);
    const directive = mocks.generateReply.mock.calls[0]![4] as string;
    expect(directive).toContain('Joint pain');
    expect(directive).toContain('do NOT end on a question');
    // The generated answer, then the app's own next question underneath it.
    expect(res.reply).toContain('<<generated>>');
    expect(res.reply).toContain('When is it worst?');
    // The symptom recorded is the ladder's, not whatever the model nominated.
    expect(lastTurn()).toMatchObject({
      symptom: 'Joint pain',
      probeAxis: 'timing',
      probeDepth: 1,
    });
  });

  it('serves the three middle rungs without a model call', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    mocks.generateReply.mockClear();

    const timing = await answer(USER, TAPS[1]!);
    expect(timing.source).toBe('probe');
    expect(timing.reply).toContain('Has anything else turned up');

    const cluster = await answer(USER, TAPS[2]!);
    expect(cluster.source).toBe('probe');
    expect(cluster.reply).toContain('Anything shifted in the last few months?');

    const context = await answer(USER, TAPS[3]!);
    expect(context.source).toBe('probe');
    expect(context.reply).toContain("What's it stopping you doing?");

    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn()).toMatchObject({ probeAxis: 'impact', probeDepth: 4 });
  });

  it('carries her answers forward rather than re-deriving them', async () => {
    await answer(USER, 'feeling body pain');
    for (const tap of TAPS.slice(0, 4)) await answer(USER, tap);

    expect(lastTurn().probeAnswers).toEqual({
      location: 'joints',
      timing: 'worst in the mornings',
      cluster: 'broken sleep',
      context: 'more stress',
    });
  });

  it('closes with the traced chain and ends the ladder', async () => {
    await answer(USER, 'feeling body pain');
    for (const tap of TAPS.slice(0, 4)) await answer(USER, tap);
    mocks.generateReply.mockClear();

    const res = await answer(USER, TAPS[4]!);

    expect(res.source).toBe('model');
    expect(res.reply).toContain(
      "Here's the thread we pulled together: joint pain, worst in the mornings, " +
        "alongside broken sleep, with more stress in the mix — and it's landing on everyday things.",
    );
    expect(res.reply).toContain('<<generated>>');
    expect(res.suggestions.at(-1)).toBe('Log joint pain');
    // probeAxis null is what ends the ladder: the next message is read fresh.
    expect(lastTurn()).toMatchObject({ probeAxis: null, probeDepth: 5, symptom: 'Joint pain' });
  });

  it('hands the turn after the close back to the classic engine', async () => {
    await answer(USER, 'feeling body pain');
    for (const tap of TAPS) await answer(USER, tap);
    mocks.generateReply.mockClear();

    await answer(USER, 'What can I do today?');
    expect(mocks.generateReply.mock.calls[0]![4]).toBeUndefined();
  });
});

describe('answering in her own words', () => {
  // Most women type rather than tap, so these are the paths that carry real
  // traffic — not the exact-chip ones above.
  it('locks the symptom from a typed answer, and says she typed it', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, 'mostly my knees, and my fingers some days');

    expect(res.source).toBe('model');
    const directive = mocks.generateReply.mock.calls[0]![4] as string;
    expect(directive).toContain('Joint pain');
    expect(directive).toContain('in her own words');
    expect(directive).not.toContain('tapped');
    // sheTyped is true, which is what the name rules in prompt.ts turn on.
    expect(mocks.generateReply.mock.calls[0]![3]).toBe(true);
    expect(res.reply).toContain('When is it worst?');
    expect(lastTurn()).toMatchObject({ symptom: 'Joint pain', probeAxis: 'timing', probeDepth: 1 });
  });

  it('advances a middle rung from her own words, with no model call', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'yes, mornings are the worst');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('Has anything else turned up');
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn().probeAnswers).toEqual({
      location: 'joints',
      timing: 'worst in the mornings',
    });
  });

  it('asks again rather than picking, when her words cover two options', async () => {
    await answer(USER, 'feeling body pain');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'my neck and my knees both');

    // No symptom was locked from an ambiguous answer — the rung is repeated.
    expect(res.reply).toContain('Where does it sit most?');
    expect(res.suggestions).toContain('Joints — knees, fingers, wrists');
    expect(lastTurn()).toMatchObject({ symptom: null, probeAxis: 'location', probeDepth: 0 });
  });
});

describe('leaving the ladder', () => {
  it('answers an aside and keeps the rung on screen', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    await answer(USER, TAPS[1]!);
    expect(lastTurn().probeAxis).toBe('cluster');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'wait, is this going to be permanent?');

    expect(res.source).toBe('model');
    // Her question is answered, and the rung she has not answered is repeated
    // underneath with its chips still offered.
    expect(res.reply).toContain('<<generated>>');
    expect(res.reply).toContain('Has anything else turned up');
    expect(res.suggestions).toContain('Sleep is broken');
    expect(mocks.generateReply.mock.calls[0]![4]).toContain('Answer HER message');
    expect(lastTurn()).toMatchObject({ probeAxis: 'cluster', probeDepth: 2, probeHandbacks: 1 });

    // And the ladder still works afterwards.
    const resumed = await answer(USER, TAPS[2]!);
    expect(resumed.source).toBe('probe');
    expect(resumed.reply).toContain('Anything shifted in the last few months?');
  });

  it('gives up after a second aside rather than badgering her', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    await answer(USER, TAPS[1]!);
    await answer(USER, 'wait, is this going to be permanent?');
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'and will HRT help with it?');

    // Classic engine, no ladder directive, no rung repeated a third time.
    expect(mocks.generateReply.mock.calls[0]![4]).toBeUndefined();
    expect(res.source).toBe('model');
    expect(res.reply).not.toContain('Has anything else turned up');
    expect(lastTurn().probeAxis).toBeNull();
  });

  it('resets the handback count once she answers a rung', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    await answer(USER, 'wait, is this going to be permanent?');
    expect(lastTurn().probeHandbacks).toBe(1);

    await answer(USER, TAPS[1]!);
    expect(lastTurn().probeHandbacks).toBe(0);

    // So a later aside gets the rung repeated again, rather than being treated
    // as the second strike of a run that ended two turns ago.
    const res = await answer(USER, 'sorry, one more thing — is it hormonal?');
    expect(res.reply).toContain('Has anything else turned up');
  });

  it('ends the ladder when she picks the way out of the first rung', async () => {
    await answer(USER, 'feeling body pain');
    const res = await answer(USER, 'Somewhere else');

    expect(res.source).toBe('probe');
    expect(res.reply).toContain('in your own words');
    expect(res.suggestions).toEqual([]);
    expect(lastTurn().probeAxis).toBeNull();
    expect(mocks.generateReply).not.toHaveBeenCalled();
  });
});

describe('safety', () => {
  it('escalates mid-ladder instead of finishing its questions', async () => {
    await answer(USER, 'feeling body pain');
    await answer(USER, TAPS[0]!);
    await answer(USER, TAPS[1]!);
    mocks.generateReply.mockClear();

    const res = await answer(USER, 'honestly I feel hopeless');

    expect(res.source).toBe('red_flag');
    expect(res.suggestions).toEqual([]);
    expect(res.escalation?.area).toBe('Mental health');
    expect(res.escalation?.helplines.map((h) => h.number)).toContain('14416');
    // The safety reply is clinician-authored and served verbatim — no model ran.
    expect(mocks.generateReply).not.toHaveBeenCalled();
    expect(lastTurn().mode).toBe('probe');

    // The ladder does not resume afterwards. Picking back up with "has anything
    // else turned up around the same months?" after a crisis reply would be
    // grotesque, so the safety turn ends it.
    const after = await answer(USER, TAPS[2]!);
    expect(after.source).toBe('model');
  });

  it('escalates a vague opener that also carries a red flag, without asking anything', async () => {
    const res = await answer(USER, 'body pain and chest pain since morning');

    expect(res.source).toBe('red_flag');
    expect(res.escalation?.area).toBe('Heart');
    expect(lastTurn().probeAxis).toBeNull();
  });
});
