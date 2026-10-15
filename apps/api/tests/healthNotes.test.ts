import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import { ZodError } from 'zod';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Notes for the doctor, end to end through the routers: consent before any AI call, drafts that
// become notes only when she confirms them, sharing that freezes a copy and records consent, taking
// a share back only before the consultation starts, and the doctor seeing only what was shared.
//
// Prisma is an in-memory stand-in covering only the query shapes the notes module issues, and the
// OpenAI calls are stubbed.

type Row = Record<string, unknown> & { id: string };

const db: Record<string, Row[]> = {};
let seq = 0;

function reset() {
  for (const table of [
    'healthNote',
    'healthNoteAttachment',
    'healthNoteShare',
    'consentRecord',
    'consultation',
    'consultationCall',
    'specialist',
  ]) {
    db[table] = [];
  }
  seq = 0;
}

/** How each model reaches its relations: [table, foreign key on child or parent, list?]. */
const RELATIONS: Record<string, Record<string, { table: string; local: string; foreign: string; list: boolean }>> = {
  healthNote: {
    attachments: { table: 'healthNoteAttachment', local: 'id', foreign: 'noteId', list: true },
    shares: { table: 'healthNoteShare', local: 'id', foreign: 'noteId', list: true },
  },
  healthNoteAttachment: {
    note: { table: 'healthNote', local: 'noteId', foreign: 'id', list: false },
  },
  healthNoteShare: {
    note: { table: 'healthNote', local: 'noteId', foreign: 'id', list: false },
    consultation: { table: 'consultation', local: 'consultationId', foreign: 'id', list: false },
  },
  consultation: {
    specialist: { table: 'specialist', local: 'specialistId', foreign: 'id', list: false },
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
    if ('lt' in c) return (value as Date) < (c.lt as Date);
    if ('lte' in c) return (value as Date) <= (c.lte as Date);
    if ('gte' in c) return (value as Date) >= (c.gte as Date);
    if ('gt' in c) return (value as Date) > (c.gt as Date);
  }
  return value === cond;
}

function matches(table: string, row: Row, where: Record<string, unknown> = {}): boolean {
  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;
    const rel = RELATIONS[table]?.[key];
    if (rel) {
      const rows = related(table, row, key);
      const c = cond as Record<string, Record<string, unknown>>;
      if (rel.list) {
        if (c.some && !rows.some((r) => matches(rel.table, r, c.some))) return false;
        if (c.none && rows.some((r) => matches(rel.table, r, c.none))) return false;
      } else {
        const target = rows[0];
        if (!target || !matches(rel.table, target, cond as Record<string, unknown>)) return false;
      }
      continue;
    }
    if (!matchValue(row[key], cond)) return false;
  }
  return true;
}

type Shape = { where?: Record<string, unknown>; select?: Record<string, unknown>; include?: Record<string, unknown> };

/** Expands relations named in select/include, honouring a nested `where`. Extra scalars are harmless. */
function shape(table: string, row: Row, spec?: Shape): Row {
  const out: Row = { ...row };
  const fields = { ...(spec?.include ?? {}), ...(spec?.select ?? {}) };
  for (const [field, sub] of Object.entries(fields)) {
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

function sortRows(rows: Row[], orderBy?: Record<string, unknown>): Row[] {
  if (!orderBy) return rows;
  const [[field, dir]] = Object.entries(orderBy);
  if (typeof dir !== 'string') return rows;
  return [...rows].sort((a, b) => {
    const av = a[field] as Date;
    const bv = b[field] as Date;
    return (av < bv ? -1 : av > bv ? 1 : 0) * (dir === 'desc' ? -1 : 1);
  });
}

const DEFAULTS: Record<string, () => Record<string, unknown>> = {
  healthNote: () => ({
    status: 'ready',
    body: null,
    rawText: null,
    unclear: false,
    language: null,
    aiUsage: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  healthNoteAttachment: () => ({ createdAt: new Date() }),
  healthNoteShare: () => ({ consentedAt: new Date(), revokedAt: null }),
  consentRecord: () => ({ grantedAt: new Date(Date.now() + seq), withdrawnAt: null }),
};

function cascadeDelete(table: string, row: Row) {
  if (table === 'healthNote') {
    db.healthNoteAttachment = db.healthNoteAttachment!.filter((r) => r.noteId !== row.id);
    db.healthNoteShare = db.healthNoteShare!.filter((r) => r.noteId !== row.id);
  }
}

function delegate(table: string) {
  const rows = () => db[table]!;
  return {
    findMany: async (args: Shape & { orderBy?: Record<string, unknown>; take?: number } = {}) =>
      sortRows(rows().filter((r) => matches(table, r, args.where)), args.orderBy)
        .slice(0, args.take ?? Infinity)
        .map((r) => shape(table, r, args)),
    findFirst: async (args: Shape & { orderBy?: Record<string, unknown> } = {}) => {
      const row = sortRows(rows().filter((r) => matches(table, r, args.where)), args.orderBy)[0];
      return row ? shape(table, row, args) : null;
    },
    findUniqueOrThrow: async (args: Shape) => {
      const row = rows().find((r) => matches(table, r, args.where));
      if (!row) throw new Error('not found');
      return shape(table, row, args);
    },
    count: async (args: Shape = {}) => rows().filter((r) => matches(table, r, args.where)).length,
    create: async (args: { data: Record<string, unknown> } & Shape) => {
      seq += 1;
      const row = { id: `${table}-${seq}`, ...(DEFAULTS[table]?.() ?? {}), ...args.data } as Row;
      rows().push(row);
      return shape(table, row, args);
    },
    update: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = rows().find((r) => matches(table, r, args.where));
      if (!row) throw new Error('not found');
      Object.assign(row, args.data, table === 'healthNote' ? { updatedAt: new Date() } : {});
      return row;
    },
    updateMany: async (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(table, r, args.where));
      for (const row of hit) Object.assign(row, args.data);
      return { count: hit.length };
    },
    delete: async (args: { where: Record<string, unknown> }) => {
      const row = rows().find((r) => matches(table, r, args.where));
      if (!row) throw new Error('not found');
      db[table] = rows().filter((r) => r !== row);
      cascadeDelete(table, row);
      return row;
    },
    deleteMany: async (args: { where: Record<string, unknown> }) => {
      const hit = rows().filter((r) => matches(table, r, args.where));
      db[table] = rows().filter((r) => !hit.includes(r));
      for (const row of hit) cascadeDelete(table, row);
      return { count: hit.length };
    },
    upsert: async (args: {
      where: { noteId_consultationId: { noteId: string; consultationId: string } };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => {
      const key = args.where.noteId_consultationId;
      const row = rows().find((r) => r.noteId === key.noteId && r.consultationId === key.consultationId);
      if (row) {
        Object.assign(row, args.update);
        return row;
      }
      seq += 1;
      const created = { id: `${table}-${seq}`, ...(DEFAULTS[table]?.() ?? {}), ...args.create } as Row;
      rows().push(created);
      return created;
    },
  };
}

vi.mock('@anuva/database', () => ({
  prisma: new Proxy({}, { get: (_target, table: string) => delegate(table) }),
}));

const transcribe = vi.fn();
const readPhoto = vi.fn();
vi.mock('../src/healthNotes/ai.js', () => ({
  transcribeVoiceNote: (...args: unknown[]) => transcribe(...args),
  readNotePhoto: (...args: unknown[]) => readPhoto(...args),
}));

const NOTE_TMP = await fs.mkdtemp(path.join(os.tmpdir(), 'anuva-health-notes-'));

type Routers = typeof import('../src/healthNotes/router.js');
type Lifecycle = typeof import('../src/healthNotes/lifecycle.js');
let routers: Routers;
let lifecycle: Lifecycle;
let shared: typeof import('@anuva/shared');
let app: express.Express;

beforeAll(async () => {
  process.env.HEALTH_NOTE_DIR = NOTE_TMP;
  routers = await import('../src/healthNotes/router.js');
  lifecycle = await import('../src/healthNotes/lifecycle.js');
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
  app.use('/health-notes', routers.createHealthNotesRouter({ resolveUserId }));
  app.use('/consultations/:id/notes', routers.createConsultationNotesRouter({ resolveUserId }));
  app.use(
    '/doctor/consultations/:id/notes',
    routers.createDoctorNotesRouter({
      resolveConsultationScope: (req) => ({ specialistId: req.header('x-doctor') ?? 'nobody' }),
    }),
  );
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

const HOUR = 60 * 60 * 1000;

function seedConsultation(opts: { id?: string; userId?: string; status?: string; startsInHours?: number; doctorStarted?: boolean } = {}) {
  const id = opts.id ?? 'consult-1';
  db.specialist!.push({ id: 'doc-1', name: 'Dr Rizwana Sayed' });
  db.consultation!.push({
    id,
    userId: opts.userId ?? 'priya',
    specialistId: 'doc-1',
    status: opts.status ?? 'confirmed',
    scheduledAt: new Date(Date.now() + (opts.startsInHours ?? 24) * HOUR),
  });
  if (opts.doctorStarted) {
    db.consultationCall!.push({ id: `call-${id}`, consultationId: id, doctorStartedAt: new Date() });
  }
  return id;
}

const webm = () => Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(64, 1)]);
const jpeg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

async function grantConsent(user = 'priya') {
  await request(app)
    .post('/health-notes/consent')
    .set('x-user', user)
    .send({ textVersion: shared.NOTE_AI_CONSENT_VERSION })
    .expect(200);
}

async function typedNote(body = 'Hot flashes every night this week', user = 'priya') {
  const res = await request(app).post('/health-notes').set('x-user', user).send({ body }).expect(201);
  return res.body.note as { id: string };
}

beforeEach(() => {
  reset();
  transcribe.mockReset();
  readPhoto.mockReset();
});

describe('sniffing', () => {
  it('tells audio containers apart, and a HEIC photo is not audio', async () => {
    const storage = await import('../src/healthNotes/storage.js');
    expect(storage.sniffAudioMimeType(webm())).toBe('audio/webm');
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypM4A '), Buffer.alloc(16)]);
    expect(storage.sniffAudioMimeType(mp4)).toBe('audio/mp4');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x1c]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    expect(storage.sniffAudioMimeType(heic)).toBeNull();
    expect(storage.sniffImageMimeType(heic)).toBeNull();
    expect(storage.sniffImageMimeType(jpeg())).toBe('image/jpeg');
    expect(storage.sniffAudioMimeType(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
  });
});

describe('consent to AI processing', () => {
  it('refuses a voice note until she consents, and never calls the model', async () => {
    const res = await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', webm(), { filename: 'note.webm', contentType: 'audio/webm' })
      .expect(403);
    expect(res.body.code).toBe('note_ai_consent_required');
    expect(transcribe).not.toHaveBeenCalled();
    expect(db.healthNote).toHaveLength(0);
  });

  it('refuses consent given to an older wording', async () => {
    await request(app).post('/health-notes/consent').set('x-user', 'priya').send({ textVersion: 'notes-ai-v0' }).expect(409);
    const res = await request(app).get('/health-notes/consent').set('x-user', 'priya').expect(200);
    expect(res.body.consent.granted).toBe(false);
  });

  it('records the consent, and withdrawing it stops new voice notes', async () => {
    await grantConsent();
    expect(db.consentRecord).toHaveLength(1);
    expect(db.consentRecord![0]).toMatchObject({ purpose: 'note_ai_processing', textVersion: shared.NOTE_AI_CONSENT_VERSION });

    await request(app).delete('/health-notes/consent').set('x-user', 'priya').expect(200);
    expect(db.consentRecord![0]!.withdrawnAt).toBeInstanceOf(Date);
    await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', webm(), { filename: 'note.webm', contentType: 'audio/webm' })
      .expect(403);

    // Agreeing again writes a new row; the withdrawn one stays as history.
    await grantConsent();
    expect(db.consentRecord).toHaveLength(2);
  });

  it('a typed note needs no AI consent', async () => {
    const note = await typedNote();
    expect(note).toMatchObject({ source: 'text', status: 'ready', body: 'Hot flashes every night this week' });
  });
});

describe('voice and photo notes', () => {
  it('a recording becomes a draft, and confirming it deletes the recording', async () => {
    await grantConsent();
    transcribe.mockResolvedValue({ text: 'raat ko bahut pasina aata hai', unclear: false, language: 'hi', usage: {} });

    const created = await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', webm(), { filename: 'note.webm', contentType: 'audio/webm' })
      .expect(201);
    const note = created.body.note;
    expect(note).toMatchObject({ source: 'voice', status: 'draft', body: 'raat ko bahut pasina aata hai' });
    expect(note.attachments).toHaveLength(1);
    const stored = db.healthNoteAttachment![0]!.storagePath as string;
    await expect(fs.access(path.join(NOTE_TMP, stored))).resolves.toBeUndefined();

    const confirmed = await request(app)
      .patch(`/health-notes/${note.id}`)
      .set('x-user', 'priya')
      .send({ body: 'Raat ko bahut pasina aata hai, 3 baje' })
      .expect(200);
    expect(confirmed.body.note).toMatchObject({ status: 'ready', body: 'Raat ko bahut pasina aata hai, 3 baje' });
    expect(confirmed.body.note.attachments).toHaveLength(0);
    await expect(fs.access(path.join(NOTE_TMP, stored))).rejects.toThrow();
    // What the model heard is kept apart from her edit, to measure accuracy.
    expect(db.healthNote![0]!.rawText).toBe('raat ko bahut pasina aata hai');
  });

  it('a model failure keeps the photo and marks the note failed; retry recovers it', async () => {
    await grantConsent();
    readPhoto.mockRejectedValueOnce(new Error('This operation was aborted'));
    const created = await request(app)
      .post('/health-notes/photo')
      .set('x-user', 'priya')
      .attach('file', jpeg(), { filename: 'note.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(created.body.note.status).toBe('failed');
    expect(created.body.note.attachments).toHaveLength(1);

    readPhoto.mockResolvedValueOnce({ text: 'Thyronorm [unclear] mcg', unclear: true, language: 'en', usage: {} });
    const retried = await request(app)
      .post(`/health-notes/${created.body.note.id}/retry`)
      .set('x-user', 'priya')
      .expect(200);
    expect(retried.body.note).toMatchObject({ status: 'draft', unclear: true, body: 'Thyronorm [unclear] mcg' });
  });

  it('a photo with nothing to read is kept as the photo, saved and shared without text', async () => {
    await grantConsent();
    readPhoto.mockResolvedValue({ kind: 'other', food: [], text: '', unclear: false, language: null, usage: {} });
    const consultationId = seedConsultation();
    const created = await request(app)
      .post('/health-notes/photo')
      .set('x-user', 'priya')
      .attach('file', jpeg(), { filename: 'rash.jpg', contentType: 'image/jpeg' })
      .expect(201);
    expect(created.body.note).toMatchObject({ source: 'photo', status: 'draft', body: null });
    expect(db.healthNote![0]!.aiUsage).toMatchObject({ photoKind: 'other' });

    const saved = await request(app)
      .patch(`/health-notes/${created.body.note.id}`)
      .set('x-user', 'priya')
      .send({ body: '  ' })
      .expect(200);
    expect(saved.body.note).toMatchObject({ status: 'ready', body: null });
    expect(saved.body.note.attachments).toHaveLength(1);

    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [created.body.note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);
    const view = await request(app).get(`/doctor/consultations/${consultationId}/notes`).set('x-doctor', 'doc-1').expect(200);
    expect(view.body.notes[0]).toMatchObject({ source: 'photo', body: '' });
    expect(view.body.notes[0].images).toHaveLength(1);
  });

  it('only a note with a photo can be saved without text', async () => {
    const note = await typedNote('Hot flashes at night');
    await request(app).patch(`/health-notes/${note.id}`).set('x-user', 'priya').send({ body: '' }).expect(400);
    expect(db.healthNote![0]!.body).toBe('Hot flashes at night');

    // A failed voice note has no photo either.
    await grantConsent();
    transcribe.mockResolvedValue({ text: '', unclear: false, language: null, usage: {} });
    const voice = await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', webm(), { filename: 'note.webm', contentType: 'audio/webm' })
      .expect(201);
    expect(voice.body.note.status).toBe('failed');
    await request(app).patch(`/health-notes/${voice.body.note.id}`).set('x-user', 'priya').send({ body: '' }).expect(400);
  });

  it('rejects a file that is not really audio', async () => {
    await grantConsent();
    await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', Buffer.from('<html><body>not audio at all</body></html>'), {
        filename: 'note.webm',
        contentType: 'audio/webm',
      })
      .expect(415);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it('caps voice and photo notes per day', async () => {
    await grantConsent();
    for (let i = 0; i < shared.HEALTH_NOTE_DAILY_AI_LIMIT; i += 1) {
      db.healthNote!.push({ id: `old-${i}`, userId: 'priya', source: 'voice', status: 'ready', deletedAt: null, createdAt: new Date() });
    }
    await request(app)
      .post('/health-notes/voice')
      .set('x-user', 'priya')
      .attach('file', webm(), { filename: 'note.webm', contentType: 'audio/webm' })
      .expect(429);
  });

  it('another account cannot read or edit her note', async () => {
    const note = await typedNote();
    await request(app).patch(`/health-notes/${note.id}`).set('x-user', 'meera').send({ body: 'x' }).expect(404);
    await request(app).delete(`/health-notes/${note.id}`).set('x-user', 'meera').expect(404);
    const list = await request(app).get('/health-notes').set('x-user', 'meera').expect(200);
    expect(list.body.notes).toHaveLength(0);
  });
});

describe('sharing with a consultation', () => {
  it('freezes the text and records the consent version on the share', async () => {
    const consultationId = seedConsultation();
    const note = await typedNote('Periods every 2 weeks since July');

    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);
    expect(db.healthNoteShare![0]).toMatchObject({
      snapshotBody: 'Periods every 2 weeks since July',
      consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION,
    });

    // Her later edit does not change what the doctor reads.
    await request(app).patch(`/health-notes/${note.id}`).set('x-user', 'priya').send({ body: 'edited later' }).expect(200);
    const doctorView = await request(app).get(`/doctor/consultations/${consultationId}/notes`).set('x-doctor', 'doc-1').expect(200);
    expect(doctorView.body.notes.map((n: { body: string }) => n.body)).toEqual(['Periods every 2 weeks since July']);
  });

  it('refuses a stale consent version, a draft, another person’s note and a cancelled consultation', async () => {
    const consultationId = seedConsultation();
    const note = await typedNote();

    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [note.id], consentTextVersion: 'notes-share-v0' })
      .expect(409);

    db.healthNote!.push({ id: 'draft-1', userId: 'priya', source: 'voice', status: 'draft', body: 'heard', deletedAt: null, createdAt: new Date() });
    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: ['draft-1'], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(409);

    const others = await typedNote('not hers', 'meera');
    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [others.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(404);

    seedConsultation({ id: 'consult-cancelled', status: 'cancelled' });
    await request(app)
      .post('/consultations/consult-cancelled/notes')
      .set('x-user', 'priya')
      .send({ noteIds: [note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(409);

    expect(db.healthNoteShare).toHaveLength(0);
  });

  it('she can take a share back before the consultation, not after the doctor started it', async () => {
    const before = seedConsultation({ id: 'consult-later' });
    const started = seedConsultation({ id: 'consult-now', startsInHours: -0.1, doctorStarted: true });
    const note = await typedNote();
    for (const id of [before, started]) {
      // The started one is still `confirmed`, so sharing is allowed while it runs.
      await request(app)
        .post(`/consultations/${id}/notes`)
        .set('x-user', 'priya')
        .send({ noteIds: [note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
        .expect(201);
    }

    await request(app).delete(`/consultations/${before}/notes/${note.id}`).set('x-user', 'priya').expect(200);
    await request(app).delete(`/consultations/${started}/notes/${note.id}`).set('x-user', 'priya').expect(409);

    // A doctor who opens the call early has started it, even though the slot is still ahead.
    const early = seedConsultation({ id: 'consult-early', startsInHours: 0.2, doctorStarted: true });
    await request(app)
      .post(`/consultations/${early}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);
    await request(app).delete(`/consultations/${early}/notes/${note.id}`).set('x-user', 'priya').expect(409);

    const doctorBefore = await request(app).get(`/doctor/consultations/${before}/notes`).set('x-doctor', 'doc-1').expect(200);
    expect(doctorBefore.body.notes).toHaveLength(0);
    const doctorStarted = await request(app).get(`/doctor/consultations/${started}/notes`).set('x-doctor', 'doc-1').expect(200);
    expect(doctorStarted.body.notes).toHaveLength(1);
  });

  it('only the consultation’s own doctor sees the notes and the photo', async () => {
    await grantConsent();
    readPhoto.mockResolvedValue({ text: 'Calcium 500 mg after lunch', unclear: false, language: 'en', usage: {} });
    const consultationId = seedConsultation();
    const created = await request(app)
      .post('/health-notes/photo')
      .set('x-user', 'priya')
      .attach('file', jpeg(), { filename: 'note.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const noteId = created.body.note.id;
    await request(app).patch(`/health-notes/${noteId}`).set('x-user', 'priya').send({ body: 'Calcium 500 mg after lunch' }).expect(200);
    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [noteId], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);

    const view = await request(app).get(`/doctor/consultations/${consultationId}/notes`).set('x-doctor', 'doc-1').expect(200);
    const shared0 = view.body.notes[0];
    expect(shared0.images).toHaveLength(1);
    await request(app)
      .get(`/doctor/consultations/${consultationId}/notes/${shared0.shareId}/images/${shared0.images[0].id}`)
      .set('x-doctor', 'doc-1')
      .expect(200)
      .expect('Cache-Control', 'private, no-store');

    await request(app).get(`/doctor/consultations/${consultationId}/notes`).set('x-doctor', 'doc-2').expect(404);
    await request(app)
      .get(`/doctor/consultations/${consultationId}/notes/${shared0.shareId}/images/${shared0.images[0].id}`)
      .set('x-doctor', 'doc-2')
      .expect(404);
  });
});

describe('deleting and erasure', () => {
  it('a note nobody holds a copy of is deleted outright, files included', async () => {
    await grantConsent();
    readPhoto.mockResolvedValue({ text: 'a note', unclear: false, language: 'en', usage: {} });
    const created = await request(app)
      .post('/health-notes/photo')
      .set('x-user', 'priya')
      .attach('file', jpeg(), { filename: 'note.jpg', contentType: 'image/jpeg' })
      .expect(201);
    const stored = db.healthNoteAttachment![0]!.storagePath as string;

    await request(app).delete(`/health-notes/${created.body.note.id}`).set('x-user', 'priya').expect(200);
    expect(db.healthNote).toHaveLength(0);
    expect(db.healthNoteAttachment).toHaveLength(0);
    await expect(fs.access(path.join(NOTE_TMP, stored))).rejects.toThrow();
  });

  it('a shared note she deletes keeps the doctor’s copy but loses her own text', async () => {
    const consultationId = seedConsultation();
    const note = await typedNote('Shared with the doctor');
    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [note.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);

    await request(app).delete(`/health-notes/${note.id}`).set('x-user', 'priya').expect(200);
    expect(db.healthNote![0]).toMatchObject({ body: null, rawText: null });
    expect(db.healthNote![0]!.deletedAt).toBeInstanceOf(Date);
    const list = await request(app).get('/health-notes').set('x-user', 'priya').expect(200);
    expect(list.body.notes).toHaveLength(0);
    const doctorView = await request(app).get(`/doctor/consultations/${consultationId}/notes`).set('x-doctor', 'doc-1').expect(200);
    expect(doctorView.body.notes[0].body).toBe('Shared with the doctor');

    // Once the consultation's record is purged, nothing holds the note back.
    db.consultation = [];
    db.healthNoteShare = [];
    await lifecycle.purgeReleasedNotes();
    expect(db.healthNote).toHaveLength(0);
  });

  it('account erasure deletes unshared notes and keeps only shared copies', async () => {
    const consultationId = seedConsultation();
    const kept = await typedNote('shared');
    await typedNote('private');
    await request(app)
      .post(`/consultations/${consultationId}/notes`)
      .set('x-user', 'priya')
      .send({ noteIds: [kept.id], consentTextVersion: shared.NOTE_SHARE_CONSENT_VERSION })
      .expect(201);

    await lifecycle.eraseHealthNotes('priya');
    expect(db.healthNote).toHaveLength(1);
    expect(db.healthNote![0]).toMatchObject({ id: kept.id, body: null });
    expect(db.healthNoteShare![0]!.snapshotBody).toBe('shared');
  });

  it('drafts she never confirmed are purged after a day', async () => {
    db.healthNote!.push(
      { id: 'stale', userId: 'priya', source: 'voice', status: 'draft', deletedAt: null, createdAt: new Date(Date.now() - 25 * HOUR) },
      { id: 'fresh', userId: 'priya', source: 'voice', status: 'draft', deletedAt: null, createdAt: new Date(Date.now() - HOUR) },
      { id: 'saved', userId: 'priya', source: 'text', status: 'ready', deletedAt: null, createdAt: new Date(Date.now() - 25 * HOUR) },
    );
    await lifecycle.purgeStaleNoteDrafts();
    expect(db.healthNote!.map((n) => n.id).sort()).toEqual(['fresh', 'saved']);
  });
});
