import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WeeklyReportResponse } from '@anuva/shared';

// Reports for the doctor, end to end through the routers: only what she can download is offered,
// nothing is shared without the current notice, each share is a frozen copy, the doctor sees only
// live shares of their own consultation, and she can take a share back at any time — which deletes
// the frozen copy and closes the PDF.
//
// Prisma is an in-memory stand-in covering only the query shapes this module issues. The report
// builders and PDF renderers are stubbed: what is tested is who gets which copy, not the drawing.

type Row = Record<string, unknown> & { id: string };

const db: Record<string, Row[]> = {};
let seq = 0;

function reset() {
  for (const table of [
    'consultation',
    'consultationCall',
    'consultationReportShare',
    'user',
    'subscription',
    'detailedAssessment',
    'detailedAnswer',
  ]) {
    db[table] = [];
  }
  seq = 0;
}

const RELATIONS: Record<string, Record<string, { table: string; local: string; foreign: string; list: boolean }>> = {
  consultation: {
    call: { table: 'consultationCall', local: 'id', foreign: 'consultationId', list: false },
  },
  user: {
    subscription: { table: 'subscription', local: 'id', foreign: 'userId', list: false },
  },
  detailedAssessment: {
    answers: { table: 'detailedAnswer', local: 'id', foreign: 'assessmentId', list: true },
  },
};

function related(table: string, row: Row, field: string): Row[] {
  const rel = RELATIONS[table]?.[field];
  if (!rel) throw new Error(`No relation ${table}.${field} in the test stand-in`);
  return (db[rel.table] ?? []).filter((other) => other[rel.foreign] === row[rel.local]);
}

function matchValue(value: unknown, cond: unknown): boolean {
  if (cond === null) return value === null || value === undefined;
  if (typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
    const c = cond as Record<string, unknown>;
    if ('in' in c) return (c.in as unknown[]).includes(value);
    if ('not' in c) return !matchValue(value, c.not);
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
  const fields = { ...(spec?.include ?? {}), ...(spec?.select ?? {}) };
  for (const [field, sub] of Object.entries(fields)) {
    const rel = RELATIONS[table]?.[field];
    if (!rel || !sub) continue;
    const subSpec = (sub === true ? {} : sub) as Shape;
    const shaped = related(table, row, field).map((r) => shape(rel.table, r, subSpec));
    out[field] = rel.list ? shaped : (shaped[0] ?? null);
  }
  return out;
}

function delegate(table: string) {
  const rows = () => db[table]!;
  return {
    findMany: async (args: Shape = {}) => rows().filter((r) => matches(table, r, args.where)).map((r) => shape(table, r, args)),
    findFirst: async (args: Shape = {}) => {
      const row = rows().find((r) => matches(table, r, args.where));
      return row ? shape(table, row, args) : null;
    },
    findUnique: async (args: Shape) => {
      const row = rows().find((r) => matches(table, r, args.where));
      return row ? shape(table, row, args) : null;
    },
    findUniqueOrThrow: async (args: Shape) => {
      const row = rows().find((r) => matches(table, r, args.where));
      if (!row) throw new Error('not found');
      return shape(table, row, args);
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(table, r, args.where));
      for (const row of hit) Object.assign(row, args.data);
      return { count: hit.length };
    },
    upsert: async (args: {
      where: { consultationId_reportKey: { consultationId: string; reportKey: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const key = args.where.consultationId_reportKey;
      const row = rows().find((r) => r.consultationId === key.consultationId && r.reportKey === key.reportKey);
      if (row) {
        Object.assign(row, args.update);
        return row;
      }
      seq += 1;
      const created = { id: `share-${seq}`, consentedAt: new Date(), revokedAt: null, ...args.create } as Row;
      rows().push(created);
      return created;
    },
  };
}

vi.mock('@anuva/database', () => ({
  prisma: new Proxy({}, { get: (_target, table: string) => delegate(table) }),
  DbNull: null,
}));

function summary(over: Partial<WeeklyReportResponse> = {}): WeeklyReportResponse {
  return {
    period: 'weekly', offset: 1,
    periodStart: '2026-10-26', periodEnd: '2026-11-01',
    coverageStart: '2026-10-26', coverageEnd: '2026-11-01',
    seriesStart: '2026-10-26', seriesCoverageStart: '2026-10-26',
    canGoBack: true, canGoForward: true, calibrating: false,
    daysLogged: 6, daysElapsed: 7, periodLength: 7, daysElapsedInPeriod: 7,
    trackingLabel: '6 of 7 days tracked', trackingNote: null, dataState: 'ready',
    referenceNote: 'Dots show last week.',
    headline: { score: 66, band: 'Good', headline: 'A steady week', body: 'Sleep carried the week.' },
    dayBalance: { good: 3, okay: 2, hard: 1, untracked: 1 },
    glance: [],
    suggestion: null,
    rings: [],
    stats: [],
    insights: [],
    joints: null,
    weekBreakdown: [],
    anuReflection: 'Steady.',
    pdf: { tier: 'full', minDays: 4, fullDays: 6 },
    ...over,
  };
}

/**
 * Her history, by period and offset. A missing offset is before her history starts: the builder
 * clamps it, as the real one does.
 */
let history: Record<'weekly' | 'monthly', Record<number, WeeklyReportResponse>>;

vi.mock('../src/report/build.js', () => ({
  buildSummary: async (_userId: string, _anchor: Date, period: 'weekly' | 'monthly', offset: number) =>
    history[period][offset] ?? { ...summary(), period, offset: offset - 1 },
}));

let report14Ready = true;
vi.mock('../src/report14/index.js', async () => {
  const { Report14Error } = await import('../src/report14/types.js');
  return {
    classifyUser: async () => {
      if (!report14Ready) throw new Report14Error(409, 'ASSESSMENT_INCOMPLETE', 'Complete your assessment.');
      return { classification: { reportId: 'R-MID-B' }, source: { userName: 'Priya' } };
    },
    buildDocument: () => ({ reportId: 'R-MID-B', title: 'Mid Perimenopause · Psychological Module' }),
    renderReportPdf: vi.fn(async () => ({
      bytes: Buffer.from('%PDF-14day'),
      cacheKey: 'k',
      cached: false,
      filename: 'anuva-assessment-report-R-MID-B.pdf',
    })),
  };
});

vi.mock('../src/periodReport/render.js', () => ({
  renderPeriodReportPdf: vi.fn(async () => Buffer.from('%PDF-period')),
  periodReportFilename: (report: WeeklyReportResponse) => `anuva-${report.period}-${report.periodStart}.pdf`,
}));

let routers: typeof import('../src/reportShares/router.js');
let shared: typeof import('@anuva/shared');
let report14: typeof import('../src/report14/index.js');
let periodRender: typeof import('../src/periodReport/render.js');
let app: express.Express;

beforeAll(async () => {
  routers = await import('../src/reportShares/router.js');
  shared = await import('@anuva/shared');
  report14 = await import('../src/report14/index.js');
  periodRender = await import('../src/periodReport/render.js');

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
  app.use('/consultations/:id/reports', routers.createConsultationReportsRouter({ resolveUserId }));
  app.use(
    '/doctor/consultations/:id/reports',
    routers.createDoctorReportsRouter({
      resolveConsultationScope: (req) => ({ specialistId: req.header('x-doctor') ?? 'nobody' }),
    }),
  );
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'Validation failed' });
      return;
    }
    res.status(err.status ?? 500).json({ error: err.message });
  });
});

const HOUR = 60 * 60 * 1000;

function seedConsultation(opts: { id?: string; userId?: string; status?: string; startsInHours?: number } = {}) {
  const id = opts.id ?? 'consult-1';
  db.consultation!.push({
    id,
    userId: opts.userId ?? 'priya',
    specialistId: 'doc-1',
    status: opts.status ?? 'confirmed',
    scheduledAt: new Date(Date.now() + (opts.startsInHours ?? 24) * HOUR),
  });
  return id;
}

beforeEach(() => {
  reset();
  report14Ready = true;
  vi.mocked(report14.renderReportPdf).mockClear();
  vi.mocked(periodRender.renderPeriodReportPdf).mockClear();
  db.user!.push({ id: 'priya', createdAt: new Date('2026-09-01') });
  db.subscription!.push({ id: 'sub-1', userId: 'priya', startedAt: new Date('2026-09-01') });
  db.detailedAssessment!.push({ id: 'da-1', userId: 'priya', status: 'completed', completedAt: new Date('2026-09-02') });
  db.detailedAnswer!.push(
    { id: 'a1', assessmentId: 'da-1', questionKey: 'hot_flash_frequency', value: 'daily' },
    { id: 'a2', assessmentId: 'da-1', questionKey: 'sleep_quality', value: 'poor' },
  );
  history = {
    weekly: {
      1: summary({ offset: 1, periodStart: '2026-10-26', periodEnd: '2026-11-01' }),
      // Too few days logged: no report, so not offered.
      2: summary({ offset: 2, periodStart: '2026-10-19', periodEnd: '2026-10-25', pdf: { tier: 'insufficient', minDays: 4, fullDays: 6 } }),
      3: summary({ offset: 3, periodStart: '2026-10-12', periodEnd: '2026-10-18', pdf: { tier: 'limited', minDays: 4, fullDays: 6 } }),
    },
    monthly: {
      1: summary({ period: 'monthly', offset: 1, periodStart: '2026-10-01', periodEnd: '2026-10-31', pdf: { tier: 'full', minDays: 15, fullDays: 24 } }),
    },
  };
});

const shareBody = (reports: { kind: string; periodStart?: string | null }[], version?: string) => ({
  reports,
  consentTextVersion: version ?? shared.REPORT_SHARE_CONSENT_VERSION,
});

describe('what she is offered', () => {
  it('her completed assessment, a ready 14-day report, and only weeks and months with a report', async () => {
    const id = seedConsultation();
    const res = await request(app).get(`/consultations/${id}/reports`).set('x-user', 'priya').expect(200);
    expect(res.body.canShare).toBe(true);
    expect(res.body.shared).toEqual([]);
    expect(res.body.available).toEqual([
      { kind: 'detailed_assessment', periodStart: null, periodEnd: null },
      { kind: 'assessment_14day', periodStart: null, periodEnd: null },
      { kind: 'weekly', periodStart: '2026-10-26', periodEnd: '2026-11-01' },
      { kind: 'weekly', periodStart: '2026-10-12', periodEnd: '2026-10-18' },
      { kind: 'monthly', periodStart: '2026-10-01', periodEnd: '2026-10-31' },
    ]);
  });

  it('nothing she has not finished: an assessment in progress, a 14-day report not ready yet', async () => {
    db.detailedAssessment![0]!.status = 'in_progress';
    report14Ready = false;
    const id = seedConsultation();
    const res = await request(app).get(`/consultations/${id}/reports`).set('x-user', 'priya').expect(200);
    expect(res.body.available.map((r: { kind: string }) => r.kind)).toEqual(['weekly', 'weekly', 'monthly']);
  });

  it('another account’s consultation is a 404', async () => {
    const id = seedConsultation({ userId: 'someone-else' });
    await request(app).get(`/consultations/${id}/reports`).set('x-user', 'priya').expect(404);
  });
});

describe('sharing', () => {
  it('needs the current notice, and shares nothing if any pick is not available', async () => {
    const id = seedConsultation();
    await request(app)
      .post(`/consultations/${id}/reports`)
      .set('x-user', 'priya')
      .send(shareBody([{ kind: 'weekly', periodStart: '2026-10-26' }], 'reports-share-v0'))
      .expect(409);
    // The week with too few days, alongside a good one: neither is shared.
    await request(app)
      .post(`/consultations/${id}/reports`)
      .set('x-user', 'priya')
      .send(shareBody([{ kind: 'weekly', periodStart: '2026-10-26' }, { kind: 'weekly', periodStart: '2026-10-19' }]))
      .expect(409);
    expect(db.consultationReportShare).toEqual([]);
  });

  it('freezes each report and records the notice; the doctor reads the copy, not her live data', async () => {
    const id = seedConsultation();
    const res = await request(app)
      .post(`/consultations/${id}/reports`)
      .set('x-user', 'priya')
      .send(shareBody([
        { kind: 'weekly', periodStart: '2026-10-26' },
        { kind: 'assessment_14day' },
        { kind: 'detailed_assessment' },
      ]))
      .expect(201);
    expect(res.body.shared).toHaveLength(3);
    expect(res.body.available.map((r: { kind: string }) => r.kind)).toEqual(['weekly', 'monthly']);
    expect(db.consultationReportShare!.every((row) => row.consentTextVersion === shared.REPORT_SHARE_CONSENT_VERSION)).toBe(true);

    // She logs more afterwards: the live week changes, the doctor's copy does not.
    history.weekly[1] = summary({ headline: { score: 20, band: 'Hard', headline: 'Changed later', body: '' } });

    const list = await request(app).get(`/doctor/consultations/${id}/reports`).set('x-doctor', 'doc-1').expect(200);
    // The detailed assessment has its own view, narrowed to the doctor's lens.
    expect(list.body.reports.map((r: { kind: string }) => r.kind).sort()).toEqual(['assessment_14day', 'weekly']);

    const weekly = list.body.reports.find((r: { kind: string }) => r.kind === 'weekly');
    const pdf = await request(app)
      .get(`/doctor/consultations/${id}/reports/${weekly.shareId}/pdf`)
      .set('x-doctor', 'doc-1')
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['cache-control']).toContain('no-store');
    const drawn = vi.mocked(periodRender.renderPeriodReportPdf).mock.calls[0]![0];
    expect(drawn.headline.headline).toBe('A steady week');

    const assessment = await routers.readSharedDetailedAssessment(id);
    expect(assessment?.assessment.answers).toEqual({ hot_flash_frequency: 'daily', sleep_quality: 'poor' });
  });

  it('the 14-day PDF the doctor gets is unlocked and never written to the cache', async () => {
    const id = seedConsultation();
    await request(app).post(`/consultations/${id}/reports`).set('x-user', 'priya').send(shareBody([{ kind: 'assessment_14day' }])).expect(201);
    const [share] = db.consultationReportShare!;
    await request(app).get(`/doctor/consultations/${id}/reports/${share!.id}/pdf`).set('x-doctor', 'doc-1').expect(200);
    expect(vi.mocked(report14.renderReportPdf).mock.calls[0]![1]).toEqual({ cache: false });
  });

  it('no other doctor, and no other consultation, can open it', async () => {
    const id = seedConsultation();
    const other = seedConsultation({ id: 'consult-2' });
    await request(app).post(`/consultations/${id}/reports`).set('x-user', 'priya').send(shareBody([{ kind: 'assessment_14day' }])).expect(201);
    const [share] = db.consultationReportShare!;
    await request(app).get(`/doctor/consultations/${id}/reports`).set('x-doctor', 'doc-2').expect(404);
    await request(app).get(`/doctor/consultations/${id}/reports/${share!.id}/pdf`).set('x-doctor', 'doc-2').expect(404);
    await request(app).get(`/doctor/consultations/${other}/reports/${share!.id}/pdf`).set('x-doctor', 'doc-1').expect(404);
    expect(await routers.readSharedDetailedAssessment(id)).toBeNull();
  });
});

describe('taking it back', () => {
  it('works at any time, even after the consultation, and deletes the frozen copy', async () => {
    const id = seedConsultation();
    await request(app)
      .post(`/consultations/${id}/reports`)
      .set('x-user', 'priya')
      .send(shareBody([{ kind: 'weekly', periodStart: '2026-10-26' }, { kind: 'detailed_assessment' }]))
      .expect(201);
    db.consultation![0]!.status = 'completed';

    const mine = await request(app).get(`/consultations/${id}/reports`).set('x-user', 'priya').expect(200);
    expect(mine.body.canShare).toBe(false);
    expect(mine.body.available).toEqual([]);
    expect(mine.body.shared.every((r: { canRevoke: boolean }) => r.canRevoke)).toBe(true);

    for (const share of mine.body.shared) {
      await request(app).delete(`/consultations/${id}/reports/${share.shareId}`).set('x-user', 'priya').expect(200);
    }
    expect(db.consultationReportShare!.every((row) => row.snapshot === null && row.revokedAt instanceof Date)).toBe(true);

    const weekly = mine.body.shared.find((r: { kind: string }) => r.kind === 'weekly');
    await request(app).get(`/doctor/consultations/${id}/reports/${weekly.shareId}/pdf`).set('x-doctor', 'doc-1').expect(404);
    const list = await request(app).get(`/doctor/consultations/${id}/reports`).set('x-doctor', 'doc-1').expect(200);
    expect(list.body.reports).toEqual([]);
    expect(await routers.readSharedDetailedAssessment(id)).toBeNull();

    // Already taken back; and after the consultation she cannot add anything.
    await request(app).delete(`/consultations/${id}/reports/${weekly.shareId}`).set('x-user', 'priya').expect(404);
    await request(app).post(`/consultations/${id}/reports`).set('x-user', 'priya').send(shareBody([{ kind: 'assessment_14day' }])).expect(409);
  });

  it('only by her', async () => {
    const id = seedConsultation();
    await request(app).post(`/consultations/${id}/reports`).set('x-user', 'priya').send(shareBody([{ kind: 'assessment_14day' }])).expect(201);
    const [share] = db.consultationReportShare!;
    await request(app).delete(`/consultations/${id}/reports/${share!.id}`).set('x-user', 'someone-else').expect(404);
    expect(share!.revokedAt).toBeNull();
  });

  it('a report she took back can be shared again, as a fresh copy', async () => {
    const id = seedConsultation();
    const send = () =>
      request(app).post(`/consultations/${id}/reports`).set('x-user', 'priya').send(shareBody([{ kind: 'weekly', periodStart: '2026-10-26' }]));
    await send().expect(201);
    const [share] = db.consultationReportShare!;
    await request(app).delete(`/consultations/${id}/reports/${share!.id}`).set('x-user', 'priya').expect(200);
    history.weekly[1] = summary({ headline: { score: 70, band: 'Good', headline: 'With a late log', body: '' } });
    await send().expect(201);
    expect(db.consultationReportShare).toHaveLength(1);
    expect(share!.revokedAt).toBeNull();
    expect((share!.snapshot as { summary: WeeklyReportResponse }).summary.headline.headline).toBe('With a late log');
  });
});
