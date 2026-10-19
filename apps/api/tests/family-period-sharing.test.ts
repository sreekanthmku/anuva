/**
 * Period sharing with family: what the card may say, what the privacy tab promises, and the consent
 * rules behind turning it on and off.
 *
 * The card is pure and pinned exactly, because its one hard rule — never let a family member infer a
 * late period — is the kind of thing a well-meaning change ("show 'a few days late'") would break.
 * The setters run against a small in-memory Prisma stand-in.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown> & { id: string };
const db: Record<string, Row[]> = { familyInvite: [], familyMember: [], familyShareConsent: [], user: [] };
let seq = 0;

function matches(row: Row, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, cond]) => row[key] === cond);
}

function delegate(table: string) {
  return {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => db[table]!.find((r) => matches(r, where)) ?? null,
    findUnique: async ({ where }: { where: Record<string, unknown> }) => db[table]!.find((r) => matches(r, where)) ?? null,
    update: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const row = db[table]!.find((r) => matches(r, where));
      if (!row) throw new Error('not found');
      return Object.assign(row, data);
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

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { buildCycleCard, buildFamilyPrivacy } = await import('../src/family/digest.js');
const { setInvitePeriodSharing, setMemberPeriodSharing } = await import('../src/family/invites.js');
const { FAMILY_PERIOD_SHARING_CONSENT_VERSION } = await import('@anuva/shared');

const base = {
  status: 'active' as const,
  phase: 'luteal' as const,
  currentCycleDay: 20,
  daysUntilNextPeriod: 9,
  nextPeriodDate: '2026-10-28',
  pendingPeriodConfirm: false,
};

describe('buildCycleCard', () => {
  it('says she is on her period, and which day', () => {
    const card = buildCycleCard({ ...base, phase: 'period', currentCycleDay: 2, daysUntilNextPeriod: 26 });
    expect(card?.headline).toBe('She’s on her period · day 2');
    expect(card?.label).toBe('Her cycle');
  });

  it('warns gently in the few days before, without a date', () => {
    const card = buildCycleCard({ ...base, daysUntilNextPeriod: 2 });
    expect(card?.headline).toBe('Her period may start in the next few days');
  });

  it('gives a rough date further out', () => {
    const card = buildCycleCard(base);
    expect(card?.headline).toMatch(/^Her next period is due around .*28/);
  });

  it('says nothing about a late period, an unconfirmed prediction, or no logs at all', () => {
    expect(buildCycleCard({ ...base, status: 'late', daysUntilNextPeriod: null })).toBeNull();
    expect(buildCycleCard({ ...base, pendingPeriodConfirm: true })).toBeNull();
    expect(buildCycleCard({ ...base, daysUntilNextPeriod: -3 })).toBeNull();
    expect(buildCycleCard({ ...base, status: 'unset', phase: null, currentCycleDay: null })).toBeNull();
    expect(buildCycleCard({ ...base, status: 'stale' })).toBeNull();
  });

  it('never mentions fertility or lateness in anything it can say', () => {
    const cards = [
      buildCycleCard({ ...base, phase: 'period', currentCycleDay: 3 }),
      buildCycleCard({ ...base, daysUntilNextPeriod: 1 }),
      buildCycleCard(base),
    ];
    for (const card of cards) {
      expect(JSON.stringify(card)).not.toMatch(/fertil|ovulat|\blate\b|overdue|pregnan/i);
    }
  });
});

describe('buildFamilyPrivacy', () => {
  it('lists her period as private unless she shares it with this person', () => {
    const off = buildFamilyPrivacy('Priya', false);
    expect(off.shared.join(' ')).not.toMatch(/period/i);
    expect(off.privateItems).toContain('Her period and cycle');

    const on = buildFamilyPrivacy('Priya', true);
    expect(on.shared.at(-1)).toMatch(/^Her period: whether she is on it/);
    expect(on.privateItems).not.toContain('Her period and cycle');
    // The details stay private either way.
    expect(on.privateItems.some((item) => /flow, period symptoms, fertility/.test(item))).toBe(true);
  });
});

describe('setting period sharing', () => {
  beforeEach(() => {
    db.familyInvite = [];
    db.familyMember = [];
    db.familyShareConsent = [];
    db.user = [{ id: 'priya', name: 'Priya', onboardingCompleted: true, familyFeatureOptOut: false, erasedAt: null }];
    db.familyMember.push({
      id: 'm1',
      userId: 'priya',
      status: 'active',
      name: 'Ravi',
      relationship: 'partner',
      phone: '+919800000001',
      createdAt: new Date(),
      lastSeenAt: new Date(),
      periodSharing: false,
    });
    db.familyInvite.push({
      id: 'inv1',
      userId: 'priya',
      status: 'pending',
      expiresAt: new Date(Date.now() + 86_400_000),
      sharedAt: null,
      shareCount: 0,
      sharePeriod: false,
    });
  });

  it('refuses to turn it on without the current notice', async () => {
    await expect(setMemberPeriodSharing('priya', 'm1', { enabled: true })).rejects.toMatchObject({ status: 409 });
    await expect(
      setMemberPeriodSharing('priya', 'm1', { enabled: true, consentTextVersion: 'family-period-v0' }),
    ).rejects.toMatchObject({ status: 409 });
    expect(db.familyShareConsent).toHaveLength(0);
  });

  it('records the wording on, and clears it off, for a person', async () => {
    const on = await setMemberPeriodSharing('priya', 'm1', {
      enabled: true,
      consentTextVersion: FAMILY_PERIOD_SHARING_CONSENT_VERSION,
    });
    expect(on.periodSharing).toBe(true);
    expect(db.familyMember[0]).toMatchObject({ periodSharingVersion: FAMILY_PERIOD_SHARING_CONSENT_VERSION });

    const off = await setMemberPeriodSharing('priya', 'm1', { enabled: false });
    expect(off.periodSharing).toBe(false);
    expect(db.familyMember[0]!.periodSharingVersion).toBeNull();

    expect(db.familyShareConsent.map((row) => [row.memberId, row.granted, row.textVersion])).toEqual([
      ['m1', true, FAMILY_PERIOD_SHARING_CONSENT_VERSION],
      ['m1', false, null],
    ]);
  });

  it('only for her own connected people', async () => {
    await expect(setMemberPeriodSharing('someone-else', 'm1', { enabled: false })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('sets the choice on her pending link, and not on a used one', async () => {
    const invite = await setInvitePeriodSharing('priya', 'inv1', {
      enabled: true,
      consentTextVersion: FAMILY_PERIOD_SHARING_CONSENT_VERSION,
    });
    expect(invite.sharePeriod).toBe(true);
    expect(db.familyShareConsent[0]).toMatchObject({ inviteId: 'inv1', granted: true });

    db.familyInvite[0]!.status = 'accepted';
    await expect(setInvitePeriodSharing('priya', 'inv1', { enabled: false })).rejects.toMatchObject({ status: 410 });
  });
});
