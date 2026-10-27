/**
 * Emergency alerts to her family: who is told, what they are told, and how often.
 *
 * The hard rules pinned here are the ones a well-meaning change would break quietly — an alert to
 * someone she did not choose, an alert that says why, a crisis reply that fails because a push
 * service was slow, or four alerts for four messages in one bad hour.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberFindFirst: vi.fn(),
  memberUpdate: vi.fn(),
  shareConsentCreate: vi.fn(),
  alertFindFirst: vi.fn(),
  alertCreate: vi.fn(),
  alertUpdate: vi.fn(),
  sendToFamilyMember: vi.fn(),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    familyMember: { findMany: mocks.memberFindMany, findFirst: mocks.memberFindFirst, update: mocks.memberUpdate },
    familyShareConsent: { create: mocks.shareConsentCreate },
    familySafetyAlert: { findFirst: mocks.alertFindFirst, create: mocks.alertCreate, update: mocks.alertUpdate },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));

vi.mock('../src/family/push.js', () => ({ sendToFamilyMember: mocks.sendToFamilyMember }));
vi.mock('../src/push/dispatch.js', () => ({ hasReachableDevice: () => ({}) }));

process.env.FAMILY_INVITE_SECRET = 'test-secret-of-at-least-32-characters-long';

const { alertFamilyIfChosen } = await import('../src/family/safetyAlert.js');
const { setMemberEmergencyAlerts } = await import('../src/family/invites.js');
const { matchRedFlag } = await import('../src/anu/redFlags.js');
const { FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION } = await import('@anuva/shared');

const USER_ID = 'user-1';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Two people she chose, both on phones that can be reached. */
function chosen(...members: { id: string; phone: string }[]) {
  mocks.memberFindMany.mockImplementation(async (args: { where: Record<string, unknown> }) =>
    'emergencyAlerts' in args.where ? members : members.map(({ phone }) => ({ phone })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userFindUnique.mockResolvedValue({ name: 'Meera Rao', erasedAt: null, familyFeatureOptOut: false });
  mocks.alertFindFirst.mockResolvedValue(null);
  mocks.alertCreate.mockResolvedValue({ id: 'alert-1' });
  mocks.alertUpdate.mockResolvedValue({});
  mocks.sendToFamilyMember.mockResolvedValue(1);
  chosen({ id: 'm-1', phone: '+911' }, { id: 'm-2', phone: '+912' });
});

describe('alertFamilyIfChosen', () => {
  it('alerts only the people she chose, and only that she may need them', async () => {
    const alerted = await alertFamilyIfChosen({ userId: USER_ID, kind: 'crisis', source: 'redFlag' });
    await flush();

    expect(alerted).toBe(true);
    expect(mocks.memberFindMany.mock.calls[0]![0].where).toMatchObject({
      userId: USER_ID,
      status: 'active',
      emergencyAlerts: true,
    });
    expect(mocks.sendToFamilyMember.mock.calls.map(([id]) => id)).toEqual(['m-1', 'm-2']);

    const [, build, data] = mocks.sendToFamilyMember.mock.calls[0]!;
    const notification = build();
    expect(notification.title).toBe('Meera may need you right now');
    const payload = data(notification);
    expect(payload.familyAlert).toBe('1');
    // Nothing that tells a self-harm alert from a medical one, anywhere they can read it.
    expect(JSON.stringify({ notification, payload })).not.toMatch(/crisis|suicid|harm|medical|pregnan/i);

    expect(mocks.alertCreate).toHaveBeenCalledWith({
      data: { userId: USER_ID, kind: 'crisis', source: 'redFlag' },
      select: { id: true },
    });
    expect(mocks.alertUpdate).toHaveBeenCalledWith({ where: { id: 'alert-1' }, data: { notified: 2 } });
  });

  it('sends nothing when she has not chosen anyone', async () => {
    chosen();
    expect(await alertFamilyIfChosen({ userId: USER_ID, kind: 'crisis', source: 'redFlag' })).toBe(false);
    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.sendToFamilyMember).not.toHaveBeenCalled();
  });

  it('sends nothing when she has turned family features off', async () => {
    mocks.userFindUnique.mockResolvedValue({ name: 'Meera', erasedAt: null, familyFeatureOptOut: true });
    expect(await alertFamilyIfChosen({ userId: USER_ID, kind: 'medical', source: 'classifier' })).toBe(false);
    expect(mocks.sendToFamilyMember).not.toHaveBeenCalled();
  });

  it('does not alert again inside the cooldown, but still says they know', async () => {
    mocks.alertFindFirst.mockResolvedValue({ id: 'alert-0', notified: 2 });
    expect(await alertFamilyIfChosen({ userId: USER_ID, kind: 'crisis', source: 'redFlag' })).toBe(true);
    await flush();
    expect(mocks.alertCreate).not.toHaveBeenCalled();
    expect(mocks.sendToFamilyMember).not.toHaveBeenCalled();
  });

  it('never throws into the reply, even when the database does', async () => {
    mocks.userFindUnique.mockRejectedValue(new Error('db down'));
    await expect(alertFamilyIfChosen({ userId: USER_ID, kind: 'crisis', source: 'redFlag' })).resolves.toBe(false);
  });

  it('does not wait for the sends, and survives one failing', async () => {
    let release!: () => void;
    mocks.sendToFamilyMember
      .mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve(1))))
      .mockRejectedValueOnce(new Error('push service down'));

    expect(await alertFamilyIfChosen({ userId: USER_ID, kind: 'crisis', source: 'redFlag' })).toBe(true);
    expect(mocks.alertUpdate).not.toHaveBeenCalled();

    release();
    await flush();
    expect(mocks.alertUpdate).toHaveBeenCalledWith({ where: { id: 'alert-1' }, data: { notified: 1 } });
  });
});

describe('setMemberEmergencyAlerts', () => {
  beforeEach(() => {
    mocks.memberFindFirst.mockResolvedValue({ id: 'm-1' });
    mocks.memberUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'm-1',
      name: 'Arjun',
      relationship: 'partner',
      phone: '+919876543210',
      createdAt: new Date('2026-10-01'),
      lastSeenAt: new Date('2026-10-20'),
      periodSharing: false,
      ...data,
    }));
  });

  it('turns on only against the notice she was shown, and records it', async () => {
    const member = await setMemberEmergencyAlerts(USER_ID, 'm-1', {
      enabled: true,
      consentTextVersion: FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION,
    });
    expect(member.emergencyAlerts).toBe(true);
    expect(mocks.shareConsentCreate).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        memberId: 'm-1',
        scope: 'emergency',
        granted: true,
        textVersion: FAMILY_EMERGENCY_ALERTS_CONSENT_VERSION,
      },
    });
  });

  it('refuses to turn on with outdated or missing wording', async () => {
    await expect(setMemberEmergencyAlerts(USER_ID, 'm-1', { enabled: true })).rejects.toMatchObject({
      code: 'consent_outdated',
    });
    await expect(
      setMemberEmergencyAlerts(USER_ID, 'm-1', { enabled: true, consentTextVersion: 'family-emergency-v0' }),
    ).rejects.toMatchObject({ code: 'consent_outdated' });
    expect(mocks.memberUpdate).not.toHaveBeenCalled();
  });

  it('turns off without any wording', async () => {
    const member = await setMemberEmergencyAlerts(USER_ID, 'm-1', { enabled: false });
    expect(member.emergencyAlerts).toBe(false);
    expect(mocks.memberUpdate.mock.calls[0]![0].data).toMatchObject({ emergencyAlerts: false, emergencyAlertsVersion: null });
  });

  it('only for someone connected to her', async () => {
    mocks.memberFindFirst.mockResolvedValue(null);
    await expect(setMemberEmergencyAlerts('someone-else', 'm-1', { enabled: false })).rejects.toMatchObject({
      code: 'member_not_found',
    });
  });
});

describe('pregnancy red flag', () => {
  it.each([
    "I'm 32 weeks pregnant and leaking fluid",
    'I am pregnant and there is some bleeding since this morning',
    'Bleeding a little, and I am 10 weeks pregnant',
    'My waters broke',
    "I'm pregnant and the baby isn't moving today",
    'Reduced fetal movements since yesterday',
    'During my pregnancy I have severe abdominal pain right now',
    "I'm pregnant, bleeding heavily and feel dizzy",
  ])('escalates: %s', (message) => {
    const match = matchRedFlag(message);
    expect(match?.rule.area).toBe('Pregnancy');
    expect(match?.rule.urgency).toBe('Urgent');
  });

  it.each([
    "Could I be pregnant? I'm spotting",
    "I'm not pregnant but my period is late",
    'Is it normal to leak a little when I sneeze?',
  ])('leaves to the model: %s', (message) => {
    expect(matchRedFlag(message)).toBeNull();
  });

  it('a crisis still comes first', () => {
    expect(matchRedFlag("I'm pregnant and I want to kill myself")?.rule.area).toBe('Mental health');
  });
});
