import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Visit summary: the pure summarisers, the renderer, and the routes end to end — a draft only she
// sees, sharing that needs the current notice and freezes the reviewed row, sections she left out
// never reaching the doctor, taking it back only before the consultation starts, and only that
// consultation's doctor ever reading it.
//
// Prisma is an in-memory stand-in covering only the query shapes these routes issue. The builder,
// which reads twenty tables, is replaced with a fixed summary; its summarisers are tested directly.

type Row = Record<string, unknown> & { id: string };

const db: Record<string, Row[]> = {};
let seq = 0;

function reset() {
  for (const table of [
    'visitSummary',
    'healthNote',
    'healthNoteAttachment',
    'healthNoteShare',
    'consultation',
    'consultationCall',
    'specialist',
    'user',
  ]) {
    db[table] = [];
  }
  seq = 0;
}

const RELATIONS: Record<string, Record<string, { table: string; local: string; foreign: string; list: boolean }>> = {
  healthNote: {
    attachments: { table: 'healthNoteAttachment', local: 'id', foreign: 'noteId', list: true },
  },
  consultation: {
    specialist: { table: 'specialist', local: 'specialistId', foreign: 'id', list: false },
    user: { table: 'user', local: 'userId', foreign: 'id', list: false },
    call: { table: 'consultationCall', local: 'id', foreign: 'consultationId', list: false },
  },
};

function related(table: string, row: Row, field: string): Row[] {
  const rel = RELATIONS[table]?.[field];
  if (!rel) throw new Error(`No relation ${table}.${field} in the test stand-in`);
  return (db[rel.table] ?? []).filter((other) => other[rel.foreign] === row[rel.local]);
}

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (cond instanceof Date) return value instanceof Date && value.getTime() === cond.getTime();
  if (typeof cond === 'object' && !Array.isArray(cond)) {
    const c = cond as Record<string, unknown>;
    if ('in' in c) return (c.in as unknown[]).includes(value);
    if ('not' in c) return !matchValue(value, c.not);
    if ('gte' in c) return (value as Date) >= (c.gte as Date);
    if ('lt' in c) return (value as Date) < (c.lt as Date);
  }
  return value === cond;
}

function matches(table: string, row: Row, where: Record<string, unknown> = {}): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    if (RELATIONS[table]?.[key]) {
      const target = related(table, row, key)[0];
      if (!target || !matches(RELATIONS[table]![key]!.table, target, cond as Record<string, unknown>)) return false;
      continue;
    }
    if (!matchValue(row[key], cond)) return false;
  }
  return true;
}

type Shape = { where?: Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown> };

function shape(table: string, row: Row, spec?: Shape): Row {
  const out: Row = { ...row };
  for (const [field, sub] of Object.entries({ ...(spec?.include ?? {}), ...(spec?.select ?? {}) })) {
    const rel = RELATIONS[table]?.[field];
    if (!rel || !sub) continue;
    const subSpec = (sub === true ? {} : sub) as Shape;
    let rows = related(table, row, field);
    if (subSpec.where) rows = rows.filter((r) => matches(rel.table, r, subSpec.where));
    const shaped = rows.map((r) => shape(rel.table, r, subSpec));
    out[field] = rel.list ? shaped : (shaped[0] ?? null);
  }
  return out;
}

const DEFAULTS: Record<string, () => Record<string, unknown>> = {
  visitSummary: () => ({
    status: 'draft',
    patientNote: null,
    consentTextVersion: null,
    sharedAt: null,
    revokedAt: null,
    createdAt: new Date(),
  }),
  healthNoteShare: () => ({ consentedAt: new Date(), revokedAt: null }),
};

function delegate(table: string) {
  const rows = () => db[table]!;
  return {
    findMany: async (args: Shape & { take?: number } = {}) =>
      rows()
        .filter((r) => matches(table, r, args.where))
        .slice(0, args.take ?? Infinity)
        .map((r) => shape(table, r, args)),
    findFirst: async (args: Shape = {}) => {
      const row = rows().find((r) => matches(table, r, args.where));
      return row ? shape(table, row, args) : null;
    },
    create: async (args: { data: Record<string, unknown> } & Shape) => {
      seq += 1;
      const row = { id: `${table}-${seq}`, ...(DEFAULTS[table]?.() ?? {}), ...args.data } as Row;
      rows().push(row);
      return shape(table, row, args);
    },
    update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> } & Shape) => {
      const row = rows().find((r) => matches(table, r, args.where));
      if (!row) throw new Error('not found');
      Object.assign(row, args.data);
      return shape(table, row, args);
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(table, r, args.where));
      for (const row of hit) Object.assign(row, args.data);
      return { count: hit.length };
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(table, r, args.where));
      db[table] = rows().filter((r) => !hit.includes(r));
      return { count: hit.length };
    },
    upsert: async (args: {
      where: { noteId_consultationId: { noteId: string; consultationId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const key = args.where.noteId_consultationId;
      const row = rows().find((r) => r.noteId === key.noteId && r.consultationId === key.consultationId);
      if (row) return Object.assign(row, args.update);
      seq += 1;
      const created = { id: `${table}-${seq}`, ...(DEFAULTS[table]?.() ?? {}), ...args.create } as Row;
      rows().push(created);
      return created;
    },
  };
}

vi.mock('@anuva/database', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, table: string) =>
        // The operations are already running by the time the array reaches here, in order.
        table === '$transaction' ? (ops: Promise<unknown>[]) => Promise.all(ops) : delegate(table),
    },
  ),
}));

const notify = vi.fn();
vi.mock('../src/doctorNotifications.js', () => ({
  notifyDoctorVisitSummaryShared: (...args: unknown[]) => notify(...args),
}));

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** What the stubbed builder returns: one of everything, so every section renders rows. */
function fixtureData() {
  return {
    profile: { age: 47, stage: 'perimenopause', assessment: null },
    cycle: {
      periods: [{ start: '2026-09-20', end: '2026-09-25', endEstimated: false, lengthDays: 6, heavyDays: 2 }],
      cycleLengths: [],
      lastPeriodStart: '2026-09-20',
      usualCycleLength: 28,
    },
    wellbeing: {
      metrics: [
        {
          key: 'sleep',
          daysLogged: 12,
          averageScore: 40,
          firstHalfScore: 55,
          secondHalfScore: 30,
          symptomDays: 7,
          topAnswers: [{ answer: 'I had disturbed sleep', count: 6 }],
        },
      ],
      hotFlashEstimate: 20,
      nightSweatNights: 4,
    },
    body: { joints: null, pain: [], bloating: [], quickSymptoms: [{ symptom: 'anxiety', count: 3 }] },
    medication: { activeReminders: 1, taken: 10, skipped: 1, missed: 3 },
    concerns: [{ date: '2026-10-02', level: 'L2', flags: ['heavy_bleeding'], pathway: 'gynecologist' }],
    lastVisit: { specialistName: 'Dr Meera Rao', date: '2026-08-12T05:30:00.000Z', documents: [] },
  };
}

vi.mock('../src/visitSummary/build.js', () => ({
  buildVisitSummary: async () => ({
    sinceConsultationId: 'consult-old',
    windowStart: new Date(Date.now() - 60 * DAY),
    windowEnd: new Date(),
    dataVersion: 1,
    data: fixtureData(),
  }),
}));

const NOTE_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'anuva-visit-summary-'));

let shared: typeof import('@anuva/shared');
let app: express.Express;

beforeAll(async () => {
  process.env.HEALTH_NOTE_DIR = NOTE_TMP;
  const routers = await import('../src/visitSummary/router.js');
  shared = await import('@anuva/shared');

  app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { log: unknown }).log = { info() {}, warn() {}, error() {} };
    next();
  });
  const resolveUserId = async (req: express.Request) => {
    const user = req.header('x-user');
    if (!user) throw Object.assign(new Error('signed out'), { status: 401 });
    return user;
  };
  app.use('/consultations/:id/summary', routers.createVisitSummaryRouter({ resolveUserId }));
  app.use(
    '/doctor/consultations/:id/summary',
    routers.createDoctorVisitSummaryRouter({
      resolveConsultationScope: (req) => ({ specialistId: req.header('x-doctor') ?? 'nobody' }),
    }),
  );
  // Four parameters is what makes Express treat this as the error handler.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed' });
      return;
    }
    res.status(err.status ?? 500).json({ error: err.message });
  });
});

afterAll(async () => {
  await fs.rm(NOTE_TMP, { recursive: true, force: true });
});

beforeEach(() => {
  reset();
  notify.mockReset();
});

function seedConsultation(opts: { startsInHours?: number; status?: string; doctorStarted?: boolean } = {}) {
  db.user!.push({ id: 'priya', name: 'Priya' });
  db.specialist!.push({ id: 'doc-1', name: 'Dr Rizwana Sayed' });
  db.consultation!.push({
    id: 'consult-1',
    userId: 'priya',
    specialistId: 'doc-1',
    status: opts.status ?? 'confirmed',
    scheduledAt: new Date(Date.now() + (opts.startsInHours ?? 24) * HOUR),
  });
  if (opts.doctorStarted) {
    db.consultationCall!.push({ id: 'call-1', consultationId: 'consult-1', doctorStartedAt: new Date() });
  }
}

async function draft(user = 'priya') {
  const res = await request(app).post('/consultations/consult-1/summary/draft').set('x-user', user).expect(201);
  return res.body.summary as { id: string; sections: { key: string }[]; notes: { noteId: string }[]; window: { label: string } };
}

function share(draftId: string, extra: Record<string, unknown> = {}) {
  return request(app)
    .post('/consultations/consult-1/summary/share')
    .set('x-user', 'priya')
    .send({ draftId, consentTextVersion: shared.VISIT_SUMMARY_SHARE_CONSENT_VERSION, ...extra });
}

// ─────────────────────────────────────────────
// Summarisers
// ─────────────────────────────────────────────

describe('summarisers', () => {
  it('measures periods, cycle gaps and heavy days', async () => {
    const { summarizeCycle } = await import('../src/visitSummary/data.js');
    const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const cycle = summarizeCycle(
      [
        { startDate: day('2026-09-28'), endDate: null, endDateSource: 'user' },
        { startDate: day('2026-08-30'), endDate: day('2026-09-03'), endDateSource: 'inferred' },
      ],
      [
        { date: day('2026-08-31'), flow: 'heavy' },
        { date: day('2026-09-01'), flow: 'regular' },
      ],
      28,
    );
    expect(cycle.periods).toEqual([
      { start: '2026-08-30', end: '2026-09-03', endEstimated: true, lengthDays: 5, heavyDays: 1 },
      { start: '2026-09-28', end: null, endEstimated: false, lengthDays: null, heavyDays: 0 },
    ]);
    expect(cycle.cycleLengths).toEqual([29]);
    expect(cycle.lastPeriodStart).toBe('2026-09-28');
  });

  it('averages per day first, counts difficult days and reads a direction of travel', async () => {
    const { summarizeMetric } = await import('../src/visitSummary/data.js');
    const scored = [
      // First half: good nights. Second half: bad ones. Day 1 has two logs and counts once.
      ...['2026-10-01', '2026-10-02', '2026-10-03'].map((day) => ({ day, score: 100, answers: ['I slept well'] })),
      { day: '2026-10-01', score: 70, answers: ['I woke up 1–2 times'] },
      ...['2026-10-08', '2026-10-09', '2026-10-10'].map((day) => ({ day, score: 10, answers: ['I barely slept'] })),
    ];
    const metric = summarizeMetric('sleep', scored, { start: '2026-10-01', end: '2026-10-10' });
    expect(metric.daysLogged).toBe(6);
    expect(metric.firstHalfScore).toBe(95);
    expect(metric.secondHalfScore).toBe(10);
    expect(metric.symptomDays).toBe(3);
    expect(metric.topAnswers[0]).toEqual({ answer: 'I barely slept', count: 3 });
  });

  it('keeps only L2+ turns, folds repeats into one concern, and never carries her words', async () => {
    const { summarizeConcerns } = await import('../src/visitSummary/data.js');
    const at = (iso: string) => new Date(`${iso}T10:00:00+05:30`);
    const flagged = {
      final_risk_level: 'L3',
      classifier: { flags: ['postmenopausal_bleeding'], recommended_pathway: 'gynecologist' },
      reply: { message: 'private words', professional_pathway: 'gynecologist' },
    };
    const concerns = summarizeConcerns([
      { createdAt: at('2026-10-05'), decision: flagged, redFlagArea: null },
      { createdAt: at('2026-10-05'), decision: flagged, redFlagArea: null },
      { createdAt: at('2026-10-06'), decision: { final_risk_level: 'L1' }, redFlagArea: null },
      { createdAt: at('2026-10-07'), decision: null, redFlagArea: 'chest_pain' },
    ]);
    expect(concerns).toEqual([
      { date: '2026-10-07', level: 'L3', flags: ['chest_pain'], pathway: null },
      { date: '2026-10-05', level: 'L3', flags: ['postmenopausal_bleeding'], pathway: 'gynecologist' },
    ]);
    expect(JSON.stringify(concerns)).not.toContain('private words');
  });

  it('counts a dose still pending after its day as missed, but not today’s', async () => {
    const { summarizeMedication } = await import('../src/visitSummary/data.js');
    expect(
      summarizeMedication(
        2,
        [
          { status: 'taken', date: '2026-10-17' },
          { status: 'pending', date: '2026-10-18' },
          { status: 'pending', date: '2026-10-19' },
          { status: 'skipped', date: '2026-10-18' },
        ],
        '2026-10-19',
      ),
    ).toEqual({ activeReminders: 2, taken: 1, skipped: 1, missed: 1 });
  });
});

describe('render', () => {
  it('drops omitted sections, and hides whom she saw when she left out her last visit', async () => {
    const { renderSections, renderWindow } = await import('../src/visitSummary/render.js');
    const data = fixtureData() as unknown as import('../src/visitSummary/data.js').VisitSummaryData;
    const sections = renderSections(data, new Date('2026-10-19T12:00:00+05:30'), ['concerns', 'lastVisit']);
    expect(sections.map((section) => section.key)).toEqual(['profile', 'cycle', 'wellbeing', 'body', 'medication']);
    const sleep = sections.find((section) => section.key === 'wellbeing')!.rows[0]!;
    expect(sleep.value).toBe('Disturbed');
    expect(sleep.detail).toContain('Worse in the second half');

    const window = { windowStart: new Date('2026-08-12'), windowEnd: new Date(), lastVisit: data.lastVisit };
    expect(renderWindow(window).label).toContain('Dr Meera Rao');
    const hidden = renderWindow({ ...window, hideVisit: true });
    expect(hidden.label).not.toContain('Dr Meera Rao');
    expect(hidden.since).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────

describe('draft and share', () => {
  it('builds a draft only she can see, then shares it under the current notice', async () => {
    seedConsultation();
    const summary = await draft();
    expect(summary.sections.map((section) => section.key)).toEqual([...shared.VISIT_SUMMARY_SECTIONS]);
    expect(summary.window.label).toContain('Dr Meera Rao');

    // A draft is not shared: the doctor sees nothing.
    const before = await request(app).get('/doctor/consultations/consult-1/summary').set('x-doctor', 'doc-1').expect(200);
    expect(before.body.summary).toBeNull();

    const res = await share(summary.id, {
      excludedSections: ['concerns'],
      patientNote: '  My periods are heavier  ',
    }).expect(201);
    expect(res.body.summary.status).toBe('shared');
    expect(res.body.summary.canRevoke).toBe(true);
    expect(db.visitSummary![0]).toMatchObject({
      status: 'shared',
      excludedSections: ['concerns'],
      patientNote: 'My periods are heavier',
      consentTextVersion: shared.VISIT_SUMMARY_SHARE_CONSENT_VERSION,
    });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ specialistId: 'doc-1', consultationId: 'consult-1' }));

    const doctor = await request(app).get('/doctor/consultations/consult-1/summary').set('x-doctor', 'doc-1').expect(200);
    expect(doctor.body.summary.patientNote).toBe('My periods are heavier');
    expect(doctor.body.summary.sections.map((section: { key: string }) => section.key)).not.toContain('concerns');
  });

  it('refuses a stale notice, someone else’s draft, and a closed consultation', async () => {
    seedConsultation();
    const summary = await draft();
    await share(summary.id, { consentTextVersion: 'visit-summary-share-v0' }).expect(409);
    await request(app)
      .post('/consultations/consult-1/summary/share')
      .set('x-user', 'someone-else')
      .send({ draftId: summary.id, consentTextVersion: shared.VISIT_SUMMARY_SHARE_CONSENT_VERSION })
      .expect(404);
    db.consultation![0]!.status = 'completed';
    await share(summary.id).expect(409);
    await request(app).post('/consultations/consult-1/summary/draft').set('x-user', 'priya').expect(409);
    expect(db.visitSummary!.every((row) => row.status === 'draft')).toBe(true);
  });

  it('will not freeze a draft older than a day', async () => {
    seedConsultation();
    const summary = await draft();
    db.visitSummary![0]!.createdAt = new Date(Date.now() - 25 * HOUR);
    const res = await share(summary.id).expect(409);
    expect(res.body.code).toBe('draft_expired');
  });

  it('replaces an earlier share instead of keeping two', async () => {
    seedConsultation();
    await share((await draft()).id).expect(201);
    await share((await draft()).id).expect(201);
    expect(db.visitSummary!.map((row) => row.status)).toEqual(['revoked', 'shared']);
  });

  it('shares the notes she ticked under the summary’s notice', async () => {
    seedConsultation();
    db.healthNote!.push({
      id: 'note-1',
      userId: 'priya',
      status: 'ready',
      body: 'Spotting after sex',
      deletedAt: null,
      createdAt: new Date(Date.now() - 3 * DAY),
    });
    const summary = await draft();
    expect(summary.notes.map((note) => note.noteId)).toEqual(['note-1']);
    await share(summary.id, { noteIds: ['note-1'] }).expect(201);
    expect(db.healthNoteShare![0]).toMatchObject({
      noteId: 'note-1',
      consultationId: 'consult-1',
      snapshotBody: 'Spotting after sex',
      consentTextVersion: shared.VISIT_SUMMARY_SHARE_CONSENT_VERSION,
    });
  });

  it('shares nothing when a ticked note is not hers', async () => {
    seedConsultation();
    db.healthNote!.push({ id: 'note-x', userId: 'someone-else', status: 'ready', body: 'x', deletedAt: null, createdAt: new Date() });
    const summary = await draft();
    await share(summary.id, { noteIds: ['note-x'] }).expect(404);
    expect(db.healthNoteShare).toHaveLength(0);
    expect(db.visitSummary![0]!.status).toBe('draft');
  });
});

describe('taking it back, and who can read it', () => {
  it('can be taken back before the consultation, and the doctor then sees nothing', async () => {
    seedConsultation();
    await share((await draft()).id).expect(201);
    await request(app).delete('/consultations/consult-1/summary/share').set('x-user', 'priya').expect(200);
    const doctor = await request(app).get('/doctor/consultations/consult-1/summary').set('x-doctor', 'doc-1').expect(200);
    expect(doctor.body.summary).toBeNull();
    const mine = await request(app).get('/consultations/consult-1/summary').set('x-user', 'priya').expect(200);
    expect(mine.body.summary).toBeNull();
  });

  it('stays with the doctor once the call has begun', async () => {
    seedConsultation();
    await share((await draft()).id).expect(201);
    db.consultationCall!.push({ id: 'call-1', consultationId: 'consult-1', doctorStartedAt: new Date() });
    await request(app).delete('/consultations/consult-1/summary/share').set('x-user', 'priya').expect(409);
    const mine = await request(app).get('/consultations/consult-1/summary').set('x-user', 'priya').expect(200);
    expect(mine.body.summary.canRevoke).toBe(false);
  });

  it('is never shown to another doctor', async () => {
    seedConsultation();
    await share((await draft()).id).expect(201);
    await request(app).get('/doctor/consultations/consult-1/summary').set('x-doctor', 'doc-2').expect(404);
  });
});

describe('lifecycle', () => {
  it('purges unshared drafts after a day and keeps shared ones through an erasure', async () => {
    const lifecycle = await import('../src/visitSummary/lifecycle.js');
    seedConsultation();
    await draft();
    await share((await draft()).id).expect(201);
    db.visitSummary![0]!.createdAt = new Date(Date.now() - 25 * HOUR);
    expect(await lifecycle.purgeStaleSummaryDrafts()).toBe(1);

    await draft();
    expect(await lifecycle.eraseVisitSummaries('priya')).toBe(1);
    expect(db.visitSummary!.map((row) => row.status)).toEqual(['shared']);
  });
});
