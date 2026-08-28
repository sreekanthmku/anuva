#!/usr/bin/env node
/**
 * Behavioural check for the family invite gate.
 *
 * There is no test runner in this repo, so this follows the `check:erasure` pattern: a plain node
 * script that either prints PASSED or exits non-zero. It runs against the real database and cleans
 * up after itself, using a reserved phone number that no real account can hold.
 *
 *   pnpm build && pnpm check:family        (from the repo root)
 *
 * It imports from dist/, so build first. Requires DATABASE_URL and FAMILY_INVITE_SECRET.
 */

import { config } from 'dotenv';

config({ path: new URL('../../../.env', import.meta.url).pathname });

const { prisma } = await import('@anuva/database');
const { getFamilyStatus, markInviteShared, rotateInvite, removeMember, computeGate } = await import(
  '../dist/family/invites.js'
);
const { parseInviteToken } = await import('../dist/family/tokens.js');
const { previewInvite, requestJoinOtp, verifyJoinOtp } = await import('../dist/family/join.js');
const { buildFamilyToday, buildFamilyPrivacy, clearDigestCache } = await import('../dist/family/digest.js');
const { NOTHING_SHARED } = await import('../dist/family/content.js');
const { recordSupportAction, kindsDoneToday } = await import('../dist/family/supportActions.js');
const { buildFamilyActivity } = await import('../dist/family/activity.js');
const { sendFamilyMessage } = await import('../dist/family/messages.js');
const { registerFamilyToken, unregisterFamilyToken } = await import('../dist/family/push.js');
const { sendDueSupportReminders } = await import('../dist/family/jobs.js');
const { buildPrivacyRecipients } = await import('../dist/privacy/recipients.js');
const { buildFamilyTopics } = await import('../dist/family/digest.js');

/**
 * Stubbed OTP provider. The whole point of injecting it into the router is that a join can be
 * exercised without spending an SMS or depending on 2Factor being reachable.
 */
function stubOtp(correctCode = '123456') {
  return {
    send: async () => 'stub-provider-session',
    verify: async (_session, code) => {
      if (code !== correctCode) {
        const error = new Error('Incorrect OTP.');
        error.status = 400;
        throw error;
      }
    },
    expiryMinutes: 10,
    resendCooldownSeconds: 0,
    maxSendsPer15Minutes: 50,
    maxVerifyAttempts: 3,
  };
}

async function expectFailure(promise, predicate) {
  return promise.then(
    () => false,
    (error) => predicate(error),
  );
}

/** Reserved for this check. Not a dialable Indian mobile, so it cannot collide with a real user. */
const PHONE = '+910000000001';
const MEMBER_PHONE = '+910000000002';

let pass = 0;
const fails = [];

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ok   ${label}`);
  } else {
    fails.push(label);
    console.log(`  FAIL ${label} ${detail}`);
  }
}

async function main() {
  await prisma.user.deleteMany({ where: { phone: PHONE } });
  const user = await prisma.user.create({
    data: {
      phone: PHONE,
      name: 'Check Account',
      onboardingCompleted: true,
      phoneVerifiedAt: new Date(),
    },
  });

  console.log('\n1. fresh account, past onboarding');
  const first = await getFamilyStatus(user.id);
  check('gate is open', first.gate.mustShare === true, JSON.stringify(first.gate));
  check('no countdown while open', first.gate.repromptAfterSeconds === null);
  check('a link exists', Boolean(first.invite));
  check('no member yet', first.member === null);
  check('message carries her first name', first.invite.shareMessage.startsWith('Check'));
  check('link is a /join fragment url', /\/join#t=/.test(first.invite.shareUrl), first.invite.shareUrl);

  console.log('\n2. token round-trip, nothing secret at rest');
  const token = first.invite.shareUrl.split('#t=')[1];
  check('token resolves to its invite', parseInviteToken(token) === first.invite.id);
  check('tampered signature rejected', parseInviteToken(`${token.slice(0, -2)}xy`) === null);
  check('tampered id rejected', parseInviteToken(`deadbeef.${token.split('.')[1]}`) === null);
  const stored = await prisma.familyInvite.findUnique({
    where: { id: first.invite.id },
    select: { tokenHash: true },
  });
  check(
    'database holds only a hash',
    !stored.tokenHash.includes(token) && /^[0-9a-f]{64}$/.test(stored.tokenHash),
    stored.tokenHash,
  );

  console.log('\n3. reading status does not churn the link');
  const again = await getFamilyStatus(user.id);
  check('same invite', again.invite.id === first.invite.id);
  check('same url', again.invite.shareUrl === first.invite.shareUrl);

  console.log('\n4. sharing closes the gate for the grace window');
  const shared = await markInviteShared(user.id, first.invite.id);
  check('gate closed', shared.gate.mustShare === false);
  check(
    'countdown is the configured window',
    shared.gate.repromptAfterSeconds > 60 && shared.gate.repromptAfterSeconds <= 10 * 60,
    String(shared.gate.repromptAfterSeconds),
  );
  check('share counted', shared.invite.shareCount === 1);
  check('still closed on re-read', (await getFamilyStatus(user.id)).gate.mustShare === false);

  console.log('\n5. the window is server-side, and it lapses');
  const now = new Date();
  const base = { optedOut: false, onboardingCompleted: true, hasMember: false };
  const longAgo = new Date(now.getTime() - 60 * 60 * 1000);
  check('an hour after a share -> open', computeGate({ ...base, sharedAt: longAgo }, now).mustShare === true);
  check(
    'a minute after a share -> closed',
    computeGate({ ...base, sharedAt: new Date(now.getTime() - 60_000) }, now).mustShare === false,
  );
  check('opted out -> never opens', computeGate({ ...base, optedOut: true, sharedAt: null }, now).mustShare === false);
  check(
    'before onboarding -> never opens',
    computeGate({ ...base, onboardingCompleted: false, sharedAt: null }, now).mustShare === false,
  );
  check('member joined -> never opens', computeGate({ ...base, hasMember: true, sharedAt: null }, now).mustShare === false);
  await prisma.familyInvite.update({ where: { id: first.invite.id }, data: { sharedAt: longAgo } });
  check('lapse through the database re-opens it', (await getFamilyStatus(user.id)).gate.mustShare === true);

  console.log('\n6. rotating gives a new, unshared link');
  const rotated = await rotateInvite(user.id);
  check('new invite id', rotated.id !== first.invite.id);
  check('new url', rotated.shareUrl !== first.invite.shareUrl);
  check('unshared, so the gate is open', rotated.sharedAt === null && rotated.shareCount === 0);
  const oldStatus = await prisma.familyInvite.findUnique({
    where: { id: first.invite.id },
    select: { status: true },
  });
  check('old link revoked', oldStatus.status === 'revoked');
  check(
    'exactly one pending invite',
    (await prisma.familyInvite.count({ where: { userId: user.id, status: 'pending' } })) === 1,
  );

  console.log('\n7. a member joining closes the gate for good');
  const member = await prisma.familyMember.create({
    data: {
      userId: user.id,
      name: 'Check Partner',
      relationship: 'partner',
      phone: MEMBER_PHONE,
      phoneVerifiedAt: new Date(),
    },
  });
  const joined = await getFamilyStatus(user.id);
  check('gate closed', joined.gate.mustShare === false);
  check('no countdown', joined.gate.repromptAfterSeconds === null);
  check('member surfaced', joined.member?.name === 'Check Partner');
  check(
    'her phone is masked',
    !joined.member.maskedPhone.includes(MEMBER_PHONE.slice(-6)) && joined.member.maskedPhone.includes('*'),
    joined.member.maskedPhone,
  );
  check('no link minted while connected', joined.invite === null);

  console.log('\n8. one-active-member is enforced by the database');
  let blocked = false;
  try {
    await prisma.familyMember.create({
      data: {
        userId: user.id,
        name: 'Second Person',
        relationship: 'child',
        phone: '+910000000003',
        phoneVerifiedAt: new Date(),
      },
    });
  } catch (error) {
    blocked = error.code === 'P2002';
  }
  check('a second active member is rejected', blocked);
  check(
    'rotating is refused while connected',
    await rotateInvite(user.id).then(
      () => false,
      (error) => error.code === 'member_exists',
    ),
  );

  console.log('\n9. removing the member re-arms the gate');
  await prisma.familySession.create({
    data: {
      tokenHash: `check-${Date.now()}`,
      familyMemberId: member.id,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await removeMember(user.id, member.id);
  check(
    'their sessions are dropped immediately',
    (await prisma.familySession.count({ where: { familyMemberId: member.id } })) === 0,
  );
  const revoked = await prisma.familyMember.findUnique({
    where: { id: member.id },
    select: { status: true },
  });
  check('the member row survives as a record', revoked.status === 'revoked');
  const reopened = await getFamilyStatus(user.id);
  check('gate open again', reopened.gate.mustShare === true);
  check('a fresh link is waiting', Boolean(reopened.invite));
  check(
    'removing twice is a 404',
    await removeMember(user.id, member.id).then(
      () => false,
      (error) => error.status === 404,
    ),
  );

  console.log('\n10. claiming an invite');
  const fresh = await getFamilyStatus(user.id);
  const joinToken = fresh.invite.shareUrl.split('#t=')[1];
  const otp = stubOtp();

  const preview = await previewInvite(joinToken);
  check('preview names her, and only her first name', preview.patientFirstName === 'Check');
  check('preview says the link is open', preview.status === 'pending');
  check(
    'an unknown token is a 404, not a hint',
    await expectFailure(previewInvite('nope.nope'), (e) => e.status === 404 && e.code === 'invite_not_found'),
  );

  // Households share phones, so her own number is a legitimate family number.
  const sharedPhoneChallenge = await requestJoinOtp(
    { token: joinToken, phone: PHONE, name: 'Shared Phone', relationship: 'partner' },
    otp,
  );
  check('her own number is accepted', Boolean(sharedPhoneChallenge.challengeId));

  const challenge = await requestJoinOtp(
    { token: joinToken, phone: MEMBER_PHONE, name: 'Check Partner', relationship: 'partner' },
    otp,
  );
  check('a code is issued', Boolean(challenge.challengeId));
  check('the phone comes back masked', challenge.maskedPhone.includes('*'));
  const challengeRow = await prisma.otpChallenge.findUnique({
    where: { id: challenge.challengeId },
    select: { purpose: true, userId: true },
  });
  check('the challenge is scoped to family_join', challengeRow.purpose === 'family_join');
  check(
    'and tied to her account so her erasure sweeps it',
    challengeRow.userId === user.id,
  );

  const joinArgs = {
    token: joinToken,
    challengeId: challenge.challengeId,
    phone: MEMBER_PHONE,
    name: 'Check Partner',
    relationship: 'partner',
  };

  check(
    'a wrong code is rejected',
    await expectFailure(verifyJoinOtp({ ...joinArgs, otp: '000000' }, otp), (e) => e.status === 400),
  );
  const afterMiss = await prisma.otpChallenge.findUnique({
    where: { id: challenge.challengeId },
    select: { attemptCount: true, status: true },
  });
  check('the failed attempt is counted', afterMiss.attemptCount === 1 && afterMiss.status === 'pending');

  const joinResult = await verifyJoinOtp({ ...joinArgs, otp: '123456' }, otp);
  check('the member is returned by first name', joinResult.body.member.firstName === 'Check');
  check('initials are derived', joinResult.body.member.initials === 'CP', joinResult.body.member.initials);
  check('her first name is returned', joinResult.body.patientFirstName === 'Check');
  check('what they can see is spelled out', joinResult.body.sharedScopes.length > 0);
  check('a session token is issued', joinResult.sessionToken.length === 64);
  const sessionRow = await prisma.familySession.findFirst({
    where: { member: { userId: user.id, status: 'active' } },
    select: { tokenHash: true },
  });
  check(
    'only the session hash is stored',
    sessionRow && sessionRow.tokenHash !== joinResult.sessionToken && /^[0-9a-f]{64}$/.test(sessionRow.tokenHash),
  );

  const acceptedInvite = await prisma.familyInvite.findUnique({
    where: { id: fresh.invite.id },
    select: { status: true, acceptedAt: true, memberId: true },
  });
  check('the invite is accepted and linked to the member', acceptedInvite.status === 'accepted' && Boolean(acceptedInvite.memberId));
  check('the gate is closed for good', (await getFamilyStatus(user.id)).gate.mustShare === false);

  console.log('\n11. a claimed link cannot be reused');
  check('preview reports it claimed', (await previewInvite(joinToken)).status === 'claimed');
  check(
    'requesting another code is refused',
    await expectFailure(
      requestJoinOtp({ token: joinToken, phone: '+910000000004', name: 'Latecomer', relationship: 'friend' }, otp),
      (e) => e.code === 'invite_claimed',
    ),
  );

  console.log('\n12. sharing stops when she says so');
  await prisma.user.update({ where: { id: user.id }, data: { familyFeatureOptOut: true } });
  const optedOutMember = await prisma.familyMember.findFirst({
    where: { userId: user.id, status: 'active' },
    select: { id: true },
  });
  check('the member row is untouched', Boolean(optedOutMember));
  const optedOutInvite = await prisma.familyInvite.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  check(
    'but a preview of any of her links goes dark',
    await expectFailure(previewInvite(joinToken), (e) => e.code === 'invite_unavailable'),
    JSON.stringify(optedOutInvite),
  );
  await prisma.user.update({ where: { id: user.id }, data: { familyFeatureOptOut: false } });

  console.log('\n13. the digest on an account with no logs at all');
  clearDigestCache();
  const today = await buildFamilyToday({
    userId: user.id,
    memberFirstName: 'Wilfred',
    patientFirstName: 'Check',
    completedKinds: [],
  });
  check('it renders rather than throwing', Boolean(today.status.headline));
  check('and says plainly that nothing is there', /nothing shared/i.test(today.status.headline), today.status.headline);
  check(
    'every metric reads as unshared',
    today.metrics.length === 4 && today.metrics.every((m) => m.value === NOTHING_SHARED),
    JSON.stringify(today.metrics.map((m) => m.value)),
  );
  check('every arrow is flat', today.metrics.every((m) => m.label.endsWith('→')));
  check('the progress card is absent, not zeroed', today.progress === null);
  check('the upcoming card is absent', today.upcoming === null);
  check('no metric value contains a number', today.metrics.every((m) => !/\d/.test(m.value)));
  check(
    'no card leaks a score anywhere',
    ![today.status.body, today.support.body, today.education.body].some((text) => /\b\d{1,3}\s*(\/|%|pts)/.test(text)),
  );
  check('it still suggests something to do', today.support.headline.length > 0);

  console.log('\n14. support actions stack within a day');
  // The member who joined in section 10 — one active member per user, so there is no second slot
  // to create a fresh actor in. That constraint is the point of section 8.
  const actor = await prisma.familyMember.findFirstOrThrow({
    where: { userId: user.id, status: 'active' },
    select: { id: true },
  });
  check('nothing done to start with', (await kindsDoneToday(actor.id)).length === 0);

  const firstAction = await recordSupportAction({ familyMemberId: actor.id, userId: user.id, kind: 'message' });
  check('a first action is recorded', firstAction.completedToday === true);

  // The bug this guards: a single unique row per day meant the second action overwrote the first.
  await recordSupportAction({ familyMemberId: actor.id, userId: user.id, kind: 'flowers' });
  const done = await kindsDoneToday(actor.id);
  check('a second, different action is also kept', done.length === 2, JSON.stringify(done));
  check('and the first is not overwritten', done.includes('message') && done.includes('flowers'));

  await recordSupportAction({ familyMemberId: actor.id, userId: user.id, kind: 'message' });
  check('repeating the same action is idempotent', (await kindsDoneToday(actor.id)).length === 2);

  for (const kind of ['call', 'chocolates']) {
    await recordSupportAction({ familyMemberId: actor.id, userId: user.id, kind });
  }
  check('all four can be taken in one day', (await kindsDoneToday(actor.id)).length === 4);
  check(
    'and that is the ceiling — four kinds, so four rows',
    (await prisma.familySupportAction.count({ where: { familyMemberId: actor.id } })) === 4,
  );

  const withActions = await buildFamilyToday({
    userId: user.id,
    memberFirstName: 'Action',
    patientFirstName: 'Check',
    completedKinds: await kindsDoneToday(actor.id),
  });
  check('today reports them all', withActions.support.completedKinds.length === 4);
  check('and still says something was done', withActions.support.completedToday === true);

  console.log('\n15. she sees that they showed up');
  const activity = await buildFamilyActivity(user.id);
  check('the member is surfaced to her', activity.member?.id === actor.id);
  check('their phone stays masked on her side too', activity.member.maskedPhone.includes('*'));
  check("today's actions are reported", activity.today?.kinds.length === 4);
  check('the headline names them', /checked in on you/.test(activity.today.headline), activity.today.headline);
  check(
    'the body reads as gestures, not a log',
    /messaged you/.test(activity.today.body) && /and/.test(activity.today.body),
    activity.today.body,
  );
  check('no clock time is disclosed', !/\d{1,2}:\d{2}/.test(activity.today.body));
  check('the week line is present', Boolean(activity.weekLine), String(activity.weekLine));
  check('days this week counted by day, not action', activity.daysThisWeek === 1, String(activity.daysThisWeek));

  console.log('\n16. with no family member she gets no card at all');
  const revokedFor = await prisma.familyMember.update({
    where: { id: actor.id },
    data: { status: 'revoked', revokedAt: new Date() },
  });
  const empty = await buildFamilyActivity(user.id);
  check('no member', empty.member === null);
  check('no today card', empty.today === null);
  check('no week line — absence of support is not news', empty.weekLine === null);
  check('and the count is zero', empty.daysThisWeek === 0);
  await prisma.familyMember.update({
    where: { id: revokedFor.id },
    data: { status: 'active', revokedAt: null },
  });

  console.log('\n17. a note is delivered and stored nowhere');
  const NOTE = 'Check-note-do-not-persist-8f3a2c';
  const noteResult = await sendFamilyMessage({
    familyMemberId: actor.id,
    memberName: 'Check Partner',
    userId: user.id,
    text: NOTE,
  });
  check('it reports honestly that there is no device to deliver to', noteResult.delivered === false);
  check('the gesture is still recorded as a check-in', /check-in/i.test(noteResult.toast));
  check(
    'and it shows up as a message action',
    (await prisma.familySupportAction.count({ where: { familyMemberId: actor.id, kind: 'message' } })) === 1,
  );

  // The requirement is that the note is not stored anywhere, so this sweeps every text column in
  // the database rather than the handful we would think to check.
  const textColumns = await prisma.$queryRawUnsafe(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND data_type IN ('text','character varying')",
  );
  let leaks = 0;
  for (const column of textColumns) {
    const rows = await prisma
      .$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM "${column.table_name}" WHERE "${column.column_name}" LIKE '%${NOTE}%'`,
      )
      .catch(() => [{ n: 0 }]);
    if (rows[0].n > 0) {
      leaks += 1;
      console.log(`  LEAK ${column.table_name}.${column.column_name}`);
    }
  }
  check(`the note is in none of the ${textColumns.length} text columns in the database`, leaks === 0);

  let rateLimited = false;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    try {
      await sendFamilyMessage({
        familyMemberId: actor.id,
        memberName: 'Check Partner',
        userId: user.id,
        text: `flood ${attempt}`,
      });
    } catch (error) {
      if (error.code === 'message_rate_limited') rateLimited = true;
    }
  }
  check('notes are rate limited, so this cannot be used to pester her', rateLimited);

  console.log('\n18. she is told who else has her data (DPDP §11)');
  const recipients = await buildPrivacyRecipients(user.id);
  check('the family member is disclosed', recipients.length === 1);
  // The member who joined back in section 10 — there is only ever one active slot.
  check('by name, not as "a family member"', /Check Partner/.test(recipients[0].name), recipients[0].name);
  check('with the relationship spelled out', /partner/.test(recipients[0].name));
  check('what they can see is listed', recipients[0].receives.length > 0);
  check('and how to stop it', /Disconnect/i.test(recipients[0].control));
  check('dated', Boolean(recipients[0].since));

  await prisma.familyMember.update({ where: { id: actor.id }, data: { status: 'revoked' } });
  check(
    'a disconnected member is not listed — they hold nothing now',
    (await buildPrivacyRecipients(user.id)).length === 0,
  );
  await prisma.familyMember.update({ where: { id: actor.id }, data: { status: 'active' } });

  console.log('\n19. family devices register for push');
  await registerFamilyToken({ familyMemberId: actor.id, token: 'check-token-1', platform: 'WEB' });
  check('a token is stored', (await prisma.familyFcmToken.count({ where: { familyMemberId: actor.id } })) === 1);
  await registerFamilyToken({ familyMemberId: actor.id, token: 'check-token-1', platform: 'WEB' });
  check('re-registering the same device does not duplicate it', (await prisma.familyFcmToken.count({ where: { familyMemberId: actor.id } })) === 1);
  await unregisterFamilyToken({ familyMemberId: actor.id, token: 'check-token-1' });
  check('and it can be removed', (await prisma.familyFcmToken.count({ where: { familyMemberId: actor.id } })) === 0);

  console.log('\n20. the reminder they asked for fires once');
  await prisma.familyMember.update({
    where: { id: actor.id },
    data: { supportRemindAt: new Date(Date.now() - 60_000) },
  });
  await sendDueSupportReminders();
  const afterReminder = await prisma.familyMember.findUnique({
    where: { id: actor.id },
    select: { supportRemindAt: true },
  });
  // Cleared before sending, so a push failure cannot leave it armed to fire on every later tick.
  check('the reminder is cleared, so it cannot loop', afterReminder.supportRemindAt === null);

  console.log('\n21. learn topics come from the real library');
  const topics = buildFamilyTopics();
  check('four topics are served', topics.length === 4, JSON.stringify(topics));
  check('they are real article titles, not the placeholders', !topics.includes('Perimenopause and hormones'));
  check(
    'they rotate week to week',
    JSON.stringify(topics) !== JSON.stringify(buildFamilyTopics(new Date(Date.now() + 7 * 86_400_000))),
  );

  console.log('\n22. the privacy tab describes what the digest actually emits');
  const privacy = buildFamilyPrivacy('Check');
  check('it names the four metrics', /sleep, mood, stress, energy/.test(privacy.shared[0]), privacy.shared[0]);
  check('it does not promise direction-only, since bands are shown too', !/direction only/i.test(privacy.shared[0]));
  check('it promises no scores', /never scores/.test(privacy.shared[0]));
  check('records and chat are listed as never shared', privacy.privateItems.length >= 4);
  check(
    'the specialist is explicitly never shared',
    privacy.privateItems.some((item) => /specialist/i.test(item)),
  );
}

try {
  await main();

} finally {
  await prisma.user.deleteMany({ where: { phone: PHONE } });
  await prisma.$disconnect();
}

console.log(`\n${fails.length ? 'FAILED' : 'PASSED'} — ${pass} checks ok, ${fails.length} failed`);
if (fails.length) {
  console.log(fails.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
