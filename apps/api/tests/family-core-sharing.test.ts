/**
 * Consent to the minimum family sharing: a link cannot go out without it, the optional extras can be
 * chosen on the link, and no push reaches a family member she has not agreed to share with.
 *
 * Runs against a small in-memory Prisma stand-in, the same one the period-sharing tests use.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id: string };
const db: Record<string, Row[]> = { familyInvite: [], familyMember: [], familyShareConsent: [], user: [] };
let seq = 0;

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => row[key] === cond);
}

/** `select` is honoured where the code reads relations or relies on absent columns reading as null. */
function project(table: string, row: Row | undefined, select?: Record<string, unknown>): Row | null {
  if (!row) return null;
  if (!select) return row;
  const out: Row = { id: row.id };
  for (const key of Object.keys(select)) {
    if (key === 'user' && table === 'familyMember') {
      out.user = db.user!.find((u) => u.id === row.userId) ?? null;
    } else {
      out[key] = row[key] ?? null;
    }
  }
  return out;
}

function delegate(table: string) {
  return {
    findFirst: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) =>
      project(table, db[table]!.find((r) => matches(r, where)), select),
    findUnique: async ({ where, select }: { where: Record<string, unknown>; select?: Record<string, unknown> }) =>
      project(table, db[table]!.find((r) => matches(r, where)), select),
    findMany: async ({ where }: { where: Record<string, unknown> }) => db[table]!.filter((r) => matches(r, where)),
    update: async ({ where, data, select }: { where: Record<string, unknown>; data: Record<string, unknown>; select?: Record<string, unknown> }) => {
      const row = db[table]!.find((r) => matches(r, where));
      if (!row) throw new Error('not found');
      const updated = Object.assign(row, Object.fromEntries(
        Object.entries(data).filter(([, value]) => value instanceof Date || typeof value !== 'object' || value === null),
      ));
      return project(table, updated, select);
    },
    create: async ({ data }: { data: Record<string, unknown> }) => {
      seq += 1;
      const row = { id: `${table}-${seq}`, createdAt: new Date(), ...data } as Row;
      db[table]!.push(row);
      return row;
    },
  };
}

vi.mock('@anuva/database', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, table: string) =>
        table === '$transaction' ? (ops: Promise<unknown>[]) => Promise.all(ops) : delegate(table),
    },
  ),
}));

const sendToAudience = vi.fn(async () => ({ successCount: 1 }));
vi.mock('../src/push/dispatch.js', () => ({ sendToAudience, hasReachableDevice: async () => true }));
vi.mock('../src/i18n/recipients.js', () => ({ languageForFamilyMember: async () => null }));

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { markInviteShared, setInviteCoreSharing, setInviteEmergencyAlerts } = await import('../src/family/invites.js');
const { sendToFamilyMember } = await import('../src/family/push.js');
const { FAMILY_CORE_SHARING_CONSENT_VERSION, FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION } = await import('@anuva/shared');

const notification = { title: 'Hello', body: 'From her' };

beforeEach(() => {
  sendToAudience.mockClear();
  db.familyInvite = [
    {
      id: 'inv1',
      userId: 'priya',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      sharedAt: null,
      shareCount: 0,
      sharePeriod: false,
      shareEmergency: false,
      coreSharingVersion: null,
    },
  ];
  db.familyMember = [];
  db.familyShareConsent = [];
  db.user = [{ id: 'priya', name: 'Priya', onboardingCompleted: true, familyFeatureOptOut: false, erasedAt: null }];
});

describe('minimum sharing on her link', () => {
  it('will not let the link be sent until she agrees', async () => {
    await expect(markInviteShared('priya', 'inv1')).rejects.toMatchObject({ status: 409, code: 'core_consent_required' });
    expect(db.familyInvite[0]!.sharedAt).toBeNull();
  });

  it('refuses agreement to anything but the current notice', async () => {
    await expect(setInviteCoreSharing('priya', 'inv1', { enabled: true })).rejects.toMatchObject({ status: 409 });
    await expect(
      setInviteCoreSharing('priya', 'inv1', { enabled: true, consentTextVersion: 'family-core-v0' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.familyShareConsent).toHaveLength(0);
  });

  it('records her agreement, after which the link can be sent', async () => {
    const invite = await setInviteCoreSharing('priya', 'inv1', {
      enabled: true,
      consentTextVersion: FAMILY_CORE_SHARING_CONSENT_VERSION,
    });
    expect(invite.coreSharing).toBe(true);
    expect(db.familyShareConsent[0]).toMatchObject({
      inviteId: 'inv1',
      scope: 'core',
      granted: true,
      textVersion: FAMILY_CORE_SHARING_CONSENT_VERSION,
    });

    const shared = await markInviteShared('priya', 'inv1');
    expect(shared.invite.sharedAt).not.toBeNull();
  });

  it('lets her untick it before anyone joins, which blocks sending again', async () => {
    await setInviteCoreSharing('priya', 'inv1', { enabled: true, consentTextVersion: FAMILY_CORE_SHARING_CONSENT_VERSION });
    const off = await setInviteCoreSharing('priya', 'inv1', { enabled: false });
    expect(off.coreSharing).toBe(false);
    await expect(markInviteShared('priya', 'inv1')).rejects.toMatchObject({ code: 'core_consent_required' });
  });
});

describe('emergency alerts on her link', () => {
  it('needs the current notice to turn on, and records the choice', async () => {
    await expect(setInviteEmergencyAlerts('priya', 'inv1', { enabled: true })).rejects.toMatchObject({ status: 409 });

    const invite = await setInviteEmergencyAlerts('priya', 'inv1', {
      enabled: true,
      consentTextVersion: FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION,
    });
    expect(invite.shareEmergency).toBe(true);
    expect(db.familyShareConsent[0]).toMatchObject({ inviteId: 'inv1', scope: 'emergency', granted: true });
  });

  it('only on a pending link', async () => {
    db.familyInvite[0]!.status = 'accepted';
    await expect(setInviteEmergencyAlerts('priya', 'inv1', { enabled: false })).rejects.toMatchObject({ status: 410 });
  });
});

describe('every push checks her consent', () => {
  function member(overrides: Record<string, unknown> = {}) {
    db.familyMember.push({
      id: 'm1',
      userId: 'priya',
      status: 'active',
      coreSharingVersion: FAMILY_CORE_SHARING_CONSENT_VERSION,
      periodSharing: false,
      emergencyAlerts: false,
      ...overrides,
    });
  }

  it('reaches a member she agreed to share with', async () => {
    member();
    expect(await sendToFamilyMember('m1', notification, {})).toBe(1);
    expect(sendToAudience).toHaveBeenCalledTimes(1);
  });

  it('sends nothing to a member without consent to the minimum', async () => {
    member({ coreSharingVersion: null });
    expect(await sendToFamilyMember('m1', notification, {})).toBe(0);
    expect(sendToAudience).not.toHaveBeenCalled();
  });

  it('sends nothing to someone no longer connected, or once she has turned sharing off', async () => {
    member({ status: 'revoked' });
    expect(await sendToFamilyMember('m1', notification, {})).toBe(0);

    db.familyMember = [];
    member();
    db.user[0]!.familyFeatureOptOut = true;
    expect(await sendToFamilyMember('m1', notification, {})).toBe(0);
    expect(sendToAudience).not.toHaveBeenCalled();
  });

  it('sends an emergency push only to someone she chose to alert', async () => {
    member();
    expect(await sendToFamilyMember('m1', notification, {}, { requires: 'emergency' })).toBe(0);

    db.familyMember[0]!.emergencyAlerts = true;
    expect(await sendToFamilyMember('m1', notification, {}, { requires: 'emergency' })).toBe(1);
  });
});
