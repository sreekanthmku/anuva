/**
 * The support loop, both legs: a note from her family lands on her phone, and the one tap she can
 * answer it with lands on theirs.
 *
 * Nothing on either leg is stored — the note lives in a URL fragment and the thank-you lives only
 * as long as its notification. So the *push payload is the feature*, and these tests exist to pin
 * its shape, because three consumers read it and none of them are typed:
 *
 *   - `apps/pwa/public/firebase-messaging-sw.js` and `apps/family-pwa/public/firebase-messaging-sw.js`
 *     resolve the click target from `data.url`;
 *   - `apps/pwa/src/features/family/useFamilyMessage.ts` reads `data.familyMessage` / `data.familyGift`
 *     on the foreground path;
 *   - `apps/family-pwa/src/features/notifications/ThanksListener.tsx` renders its card only when
 *     `data.familyThanks` is present, and titles it from `data.familyThanksFrom`.
 *
 * Renaming any of those keys type-checks cleanly and breaks the loop silently. That is what is
 * guarded here.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendPushToAllTokens: vi.fn(),
  fcmTokenFindMany: vi.fn(),
  supportActionUpsert: vi.fn(),
  userFindUnique: vi.fn(),
  familyMemberFindMany: vi.fn(),
  familyFcmTokenFindMany: vi.fn(),
  nudgeLogFindFirst: vi.fn(),
  nudgeLogUpdateMany: vi.fn(),
}));

vi.mock('@anuva/database', () => ({
  prisma: {
    fcmToken: { findMany: mocks.fcmTokenFindMany },
    familySupportAction: { upsert: mocks.supportActionUpsert },
    user: { findUnique: mocks.userFindUnique },
    familyMember: { findMany: mocks.familyMemberFindMany },
    familyFcmToken: { findMany: mocks.familyFcmTokenFindMany },
    // Sending a note attributes it to whichever nudge prompted it. That is measurement, not
    // delivery — it is covered in family-nudges.test.ts — but it runs on this path, so the
    // delegate has to exist or every test here dies inside attributeSupportAction.
    familyNudgeLog: { findFirst: mocks.nudgeLogFindFirst, updateMany: mocks.nudgeLogUpdateMany },
  },
}));

// Mocked at the transport boundary rather than at `sendToFamilyMember`, so the real push.ts runs
// and its token lookup and de-duplication are covered too.
vi.mock('../src/fcm.js', () => ({ sendPushToAllTokens: mocks.sendPushToAllTokens }));

const { sendFamilyMessage } = await import('../src/family/messages.js');
const { sendFamilyThanks } = await import('../src/family/thanks.js');
const { resetRateLimits } = await import('../src/family/rateLimit.js');

const USER_ID = 'user-1';
const MEMBER_ID = 'member-1';

type Push = {
  tokens: string[];
  notification: { title: string; body: string };
  data: Record<string, string>;
};

/** The last push handed to FCM, with the loose tuple narrowed once instead of at every call site. */
function lastPush(): Push {
  const call = mocks.sendPushToAllTokens.mock.calls.at(-1);
  expect(call, 'expected a push to have been sent').toBeDefined();
  const [tokens, notification, data] = call as [Push['tokens'], Push['notification'], Push['data']];
  return { tokens, notification, data };
}

/** The fragment half of a deep link, parsed the way the PWA parses it. */
function fragmentOf(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf('#') + 1));
}

beforeEach(() => {
  resetRateLimits();
  // Implementations are re-established rather than cleared, so one test's override cannot leak.
  mocks.sendPushToAllTokens.mockReset().mockResolvedValue({ successCount: 1, failureCount: 0 });
  mocks.fcmTokenFindMany.mockReset().mockResolvedValue([{ token: 'her-device' }]);
  mocks.supportActionUpsert.mockReset().mockResolvedValue({});
  mocks.userFindUnique.mockReset().mockResolvedValue({ name: 'Meera Rao' });
  mocks.familyMemberFindMany.mockReset().mockResolvedValue([{ id: MEMBER_ID }]);
  mocks.familyFcmTokenFindMany.mockReset().mockResolvedValue([{ token: 'his-device' }]);
  // No recent nudge by default: these tests are about the payload, not about what prompted it.
  mocks.nudgeLogFindFirst.mockReset().mockResolvedValue(null);
  mocks.nudgeLogUpdateMany.mockReset().mockResolvedValue({ count: 0 });
});

async function sendNote(text: string, overrides: { familyMemberId?: string } = {}) {
  return sendFamilyMessage({
    familyMemberId: overrides.familyMemberId ?? MEMBER_ID,
    memberName: 'Wilfred Rao',
    userId: USER_ID,
    text,
  });
}

// ─────────────────────────────────────────────
// Leg one: their note reaches her
// ─────────────────────────────────────────────

describe('a note from her family', () => {
  it('reaches her phone titled with their first name, with the note as the body', async () => {
    const result = await sendNote('Thinking of you today.');

    expect(result).toEqual({ delivered: true, toast: '✓ Sent. She will see it on her phone.' });
    expect(lastPush().notification).toEqual({
      title: 'Wilfred sent you a message',
      body: 'Thinking of you today.',
    });
  });

  it('carries the note in the fragment, never where a server would log it', async () => {
    await sendNote('Thinking of you today.');
    const { url } = lastPush().data;

    // The whole privacy argument for this feature is that the note is not sent to a server on the
    // click. A query string would be, and would land in an access log.
    expect(url.split('#')[0]).toBe('/home');
    expect(url).not.toContain('?');
    expect(fragmentOf(url).get('familyMessage')).toBe('Thinking of you today.');
    expect(fragmentOf(url).get('familyFrom')).toBe('Wilfred');
  });

  it('carries the note in `data` too, for the foreground path', async () => {
    // FCM displays nothing for a foreground push, so useFamilyMessage opens the card straight from
    // `data` — these two keys are its whole input.
    await sendNote('Thinking of you today.');
    const { data } = lastPush();

    expect(data.familyMessage).toBe('Thinking of you today.');
    expect(data.familyFrom).toBe('Wilfred');
  });

  it('survives the characters people actually type', async () => {
    // & and = would split the fragment and # would truncate it, so encoding is load-bearing.
    const text = 'Call me? 50% better & no #sleep — love you ❤️';
    await sendNote(text);
    const { data } = lastPush();

    expect(fragmentOf(data.url).get('familyMessage')).toBe(text);
    expect(data.familyMessage).toBe(text);
  });

  it('records the gesture before delivery, so her check-in card does not depend on her phone', async () => {
    mocks.fcmTokenFindMany.mockResolvedValue([]);

    const result = await sendNote('Thinking of you today.');

    expect(mocks.supportActionUpsert).toHaveBeenCalledOnce();
    expect(mocks.supportActionUpsert.mock.calls[0][0].create).toMatchObject({
      familyMemberId: MEMBER_ID,
      userId: USER_ID,
      kind: 'message',
    });
    expect(mocks.sendPushToAllTokens).not.toHaveBeenCalled();
    expect(result.delivered).toBe(false);
    expect(result.toast).toContain('Saved as a check-in');
  });

  it('says so plainly when her phone refuses the notification', async () => {
    mocks.sendPushToAllTokens.mockResolvedValue({ successCount: 0, failureCount: 1 });

    const result = await sendNote('Thinking of you today.');

    expect(result.delivered).toBe(false);
    expect(result.toast).toBe('Saved as a check-in, but her phone did not accept the notification.');
  });

  it('notifies each of her devices once, not once per stored row', async () => {
    mocks.fcmTokenFindMany.mockResolvedValue([
      { token: 'her-phone' },
      { token: 'her-phone' },
      { token: 'her-tablet' },
    ]);

    await sendNote('Thinking of you today.');

    expect(lastPush().tokens).toEqual(['her-phone', 'her-tablet']);
  });

  it('stops a family member using notes as a channel for pestering her', async () => {
    // Six an hour, keyed per member.
    for (let i = 0; i < 6; i += 1) {
      await sendNote(`note ${i}`);
    }

    await expect(sendNote('one too many')).rejects.toMatchObject({
      status: 429,
      code: 'message_rate_limited',
    });

    // A different member is unaffected — the limit is theirs, not hers.
    await expect(sendNote('hello', { familyMemberId: 'member-2' })).resolves.toMatchObject({
      delivered: true,
    });
  });
});

// ─────────────────────────────────────────────
// Leg two: her thank-you reaches them
// ─────────────────────────────────────────────

describe('her thank-you', () => {
  it('carries `familyThanks`, which is the only thing the family app keys off', async () => {
    // ThanksListener returns early without this key, so the app the family installed to receive
    // exactly one notification would receive nothing.
    const result = await sendFamilyThanks({ userId: USER_ID, kind: 'message' });

    const { data, notification } = lastPush();
    expect(data.familyThanks).toBe('message');
    expect(data.familyThanksFrom).toBe('Meera');
    expect(notification.title).toBe('Meera says thank you 😊');
    expect(result).toEqual({ delivered: true, toast: '✓ They will know it landed.' });
  });

  it('deep-links to Today rather than to a receipt', async () => {
    await sendFamilyThanks({ userId: USER_ID, kind: 'message' });
    expect(lastPush().data.url).toBe('/');
  });

  it('names the gesture it answers', async () => {
    const expected: Record<string, string> = {
      message: 'She opened your note and it landed. 💛',
      call: 'She opened your call and it landed. 💛',
      flowers: 'She opened the flowers and it landed. 💛',
      chocolates: 'She opened the chocolates and it landed. 💛',
    };

    for (const [kind, body] of Object.entries(expected)) {
      await sendFamilyThanks({ userId: USER_ID, kind: kind as 'message' });
      expect(lastPush().notification.body, kind).toBe(body);
      expect(lastPush().data.familyThanks, kind).toBe(kind);
    }
  });

  it('falls back to a plain line when no gesture is named', async () => {
    // The check-in card thanks for the day as a whole, not for one thing.
    await sendFamilyThanks({ userId: USER_ID, memberId: MEMBER_ID });

    expect(lastPush().notification.body).toBe('She saw what you did today, and it landed. 💛');
    // 'general' rather than omitted: ThanksListener tests the key for presence, so an absent value
    // would drop the card entirely.
    expect(lastPush().data.familyThanks).toBe('general');
  });

  it('still addresses them by something when her name is not set', async () => {
    mocks.userFindUnique.mockResolvedValue({ name: null });

    await sendFamilyThanks({ userId: USER_ID, kind: 'message' });

    expect(lastPush().notification.title).toBe('She says thank you 😊');
    expect(lastPush().data.familyThanksFrom).toBe('She');
  });

  it('sends every value in `data` as a string, which is all FCM accepts', async () => {
    await sendFamilyThanks({ userId: USER_ID, kind: 'flowers' });

    for (const [key, value] of Object.entries(lastPush().data)) {
      expect(typeof value, key).toBe('string');
    }
  });

  it('stores nothing — the thank-you lives as long as its notification', async () => {
    await sendFamilyThanks({ userId: USER_ID, kind: 'message' });
    expect(mocks.supportActionUpsert).not.toHaveBeenCalled();
  });

  it('reports honestly when nobody on the other side has a device', async () => {
    mocks.familyFcmTokenFindMany.mockResolvedValue([]);

    const result = await sendFamilyThanks({ userId: USER_ID, kind: 'message' });

    expect(result).toEqual({ delivered: false, toast: 'Thank you noted.' });
    expect(mocks.sendPushToAllTokens).not.toHaveBeenCalled();
  });

  it('answers a guessed memberId exactly as it answers an empty family', async () => {
    // Same response either way, so probing ids tells the caller nothing it did not already know.
    mocks.familyMemberFindMany.mockResolvedValue([]);

    const result = await sendFamilyThanks({ userId: USER_ID, memberId: 'not-hers' });

    expect(result).toEqual({ delivered: false, toast: 'Thank you noted.' });
    expect(mocks.sendPushToAllTokens).not.toHaveBeenCalled();
  });

  it('scopes to one member when asked, and to all of them when not', async () => {
    await sendFamilyThanks({ userId: USER_ID, memberId: MEMBER_ID });
    expect(mocks.familyMemberFindMany.mock.calls[0][0].where).toMatchObject({
      userId: USER_ID,
      status: 'active',
      id: MEMBER_ID,
    });

    await sendFamilyThanks({ userId: USER_ID });
    expect(mocks.familyMemberFindMany.mock.calls[1][0].where).not.toHaveProperty('id');
  });

  it('is generous enough for a day of gestures, but is not a channel', async () => {
    for (let i = 0; i < 12; i += 1) {
      await sendFamilyThanks({ userId: USER_ID, kind: 'message' });
    }

    await expect(sendFamilyThanks({ userId: USER_ID, kind: 'message' })).rejects.toMatchObject({
      status: 429,
      code: 'thanks_rate_limited',
    });
  });
});

// ─────────────────────────────────────────────
// Both legs together
// ─────────────────────────────────────────────

describe('the round trip', () => {
  it('answers the note she opened, naming it back to the sender', async () => {
    await sendNote('Thinking of you today.');
    const toHer = lastPush();

    // What the dialog does with the note: one tap, carrying the kind it was opened from.
    await sendFamilyThanks({ userId: USER_ID, kind: 'message' });
    const toThem = lastPush();

    expect(toHer.data.familyFrom).toBe('Wilfred');
    expect(toThem.notification.title).toBe('Meera says thank you 😊');
    expect(toThem.notification.body).toContain('your note');

    // The two legs are separate token tables: hers, then theirs.
    expect(toHer.tokens).toEqual(['her-device']);
    expect(toThem.tokens).toEqual(['his-device']);
  });

  it('keeps the note itself out of the thank-you', async () => {
    // Nothing she was sent should travel back — the sender already knows what they wrote, and a
    // quoted note in a push is a copy of it living somewhere new.
    await sendNote('Thinking of you today.');
    await sendFamilyThanks({ userId: USER_ID, kind: 'message' });

    const serialised = JSON.stringify(lastPush());
    expect(serialised).not.toContain('Thinking of you today.');
  });
});
