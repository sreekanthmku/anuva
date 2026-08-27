/**
 * Family sharing — HTTP surface.
 *
 * Self-contained in the same way as the report14 module: everything it needs from the host app —
 * patient auth, phone normalisation, the OTP provider, cookie options — is injected rather than
 * imported, so this file has no dependency on the API entry point. It carries its own error
 * middleware, so wiring it up changes nothing global.
 *
 * Patient side (`anuva_session`):
 *   GET    /family/status                 the gate decision, the pending link, the member
 *   POST   /family/invites                mint a fresh link, replacing any pending one
 *   POST   /family/invites/:id/shared     record that she sent it — the only thing that closes the gate
 *   POST   /family/invites/:id/revoke     kill a pending link
 *   DELETE /family/members/:id            disconnect the family member, freeing the slot
 *
 * Public (guarded by the invite token alone):
 *   GET    /family/join/preview           her first name and whether the link still works
 *   POST   /family/join/request-otp       send a code to the family member's phone
 *   POST   /family/join/verify-otp        claim the link, create the member, open a family session
 *
 * Family side (`anuva_family_session`):
 *   GET    /family/me
 *   GET    /family/today                  the digest — the only route that reads her logs
 *   GET    /family/learn
 *   GET    /family/privacy
 *   POST   /family/support-actions
 *   POST   /family/support-actions/remind-later
 *   POST   /family/logout
 */

import { Router } from 'express';
import type { CookieOptions, NextFunction, Request, Response } from 'express';
import {
  createFamilyInviteResponseSchema,
  familyJoinPreviewResponseSchema,
  familyJoinRequestOtpBodySchema,
  familyJoinRequestOtpResponseSchema,
  familyJoinVerifyBodySchema,
  familyJoinVerifyResponseSchema,
  familyLearnResponseSchema,
  familyLogoutResponseSchema,
  familyMeResponseSchema,
  familyPrivacyResponseSchema,
  familyRemindLaterResponseSchema,
  familySupportActionBodySchema,
  familySupportActionResponseSchema,
  familyTodayResponseSchema,
  familyStatusResponseSchema,
  markFamilyInviteSharedBodySchema,
  markFamilyInviteSharedResponseSchema,
  removeFamilyMemberResponseSchema,
  revokeFamilyInviteResponseSchema,
} from '@anuva/shared';
import { FAMILY_SESSION_COOKIE_NAME } from './config.js';
import { destroyFamilySession, requireFamilyMember } from './auth.js';
import { FamilyError } from './errors.js';
import {
  getFamilyStatus,
  markInviteShared,
  removeMember,
  revokeInvite,
  rotateInvite,
} from './invites.js';
import { buildFamilyLearn, buildFamilyPrivacy, buildFamilyToday } from './digest.js';
import { familyMeBody, previewInvite, requestJoinOtp, verifyJoinOtp, type OtpDeps } from './join.js';
import { rateLimit } from './rateLimit.js';
import { hasActedToday, recordSupportAction, scheduleSupportReminder } from './supportActions.js';

export interface FamilyRouterDeps {
  /** Resolves the signed-in patient, or throws. Supplied by the host app. */
  resolveUserId: (req: Request) => Promise<string>;
  /** The host app's phone normalisation, so a family member's number is stored exactly as hers is. */
  normalizePhone: (phone: string) => string;
  /** The host app's session cookie options, so the family cookie gets the same SameSite/domain treatment. */
  sessionCookieOptions: (expiresAt?: Date) => CookieOptions;
  otp: OtpDeps;
}

/** The preview route is the only unauthenticated one. Keyed per IP, per minute. */
const PREVIEW_LIMIT = 10;
const PREVIEW_WINDOW_MS = 60_000;

function noStore(res: Response): void {
  // The gate state names a family member. Never let a shared cache hold it.
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
}

export function createFamilyRouter({
  resolveUserId,
  normalizePhone,
  sessionCookieOptions,
  otp,
}: FamilyRouterDeps): Router {
  const router = Router();

  router.get('/status', async (req, res, next) => {
    try {
      noStore(res);
      const userId = await resolveUserId(req);
      res.json(familyStatusResponseSchema.parse(await getFamilyStatus(userId)));
    } catch (e) {
      next(e);
    }
  });

  router.post('/invites', async (req, res, next) => {
    try {
      noStore(res);
      const userId = await resolveUserId(req);
      const invite = await rotateInvite(userId);
      req.log?.info?.({ inviteId: invite.id }, 'family: invite minted');
      res.json(createFamilyInviteResponseSchema.parse({ invite }));
    } catch (e) {
      next(e);
    }
  });

  router.post('/invites/:id/shared', async (req, res, next) => {
    try {
      noStore(res);
      const userId = await resolveUserId(req);
      const { channel } = markFamilyInviteSharedBodySchema.parse(req.body);
      const result = await markInviteShared(userId, req.params.id);
      req.log?.info?.(
        { inviteId: result.invite.id, channel, shareCount: result.invite.shareCount },
        'family: invite shared',
      );
      res.json(markFamilyInviteSharedResponseSchema.parse(result));
    } catch (e) {
      next(e);
    }
  });

  router.post('/invites/:id/revoke', async (req, res, next) => {
    try {
      noStore(res);
      const userId = await resolveUserId(req);
      await revokeInvite(userId, req.params.id);
      req.log?.info?.({ inviteId: req.params.id }, 'family: invite revoked');
      res.json(revokeFamilyInviteResponseSchema.parse({ revoked: true }));
    } catch (e) {
      next(e);
    }
  });

  router.delete('/members/:id', async (req, res, next) => {
    try {
      noStore(res);
      const userId = await resolveUserId(req);
      await removeMember(userId, req.params.id);
      req.log?.info?.({ memberId: req.params.id }, 'family: member removed');
      res.json(removeFamilyMemberResponseSchema.parse({ removed: true }));
    } catch (e) {
      next(e);
    }
  });

  // ── Public: claiming an invite ────────────────────────────────────────────
  // Guarded by the token alone, so each handler re-validates it from scratch.

  router.get('/join/preview', async (req, res, next) => {
    try {
      noStore(res);

      if (!rateLimit(`preview:${req.ip ?? 'unknown'}`, PREVIEW_LIMIT, PREVIEW_WINDOW_MS)) {
        throw new FamilyError(429, 'rate_limited', 'Too many attempts. Try again in a minute.');
      }

      const token = typeof req.query.token === 'string' ? req.query.token : '';
      if (!token) {
        throw new FamilyError(400, 'token_required', 'This link is not valid.');
      }

      res.json(familyJoinPreviewResponseSchema.parse(await previewInvite(token)));
    } catch (e) {
      next(e);
    }
  });

  router.post('/join/request-otp', async (req, res, next) => {
    try {
      noStore(res);
      const body = familyJoinRequestOtpBodySchema.parse(req.body);
      const result = await requestJoinOtp(
        { ...body, phone: normalizePhone(body.phone) },
        otp,
      );
      // The phone is masked here as it is everywhere else: a family join is traceable in the logs
      // without the log becoming a list of third-party phone numbers.
      req.log?.info?.(
        { challengeId: result.challengeId, phone: result.maskedPhone },
        'family: join code sent',
      );
      res.json(familyJoinRequestOtpResponseSchema.parse(result));
    } catch (e) {
      next(e);
    }
  });

  router.post('/join/verify-otp', async (req, res, next) => {
    try {
      noStore(res);
      const body = familyJoinVerifyBodySchema.parse(req.body);
      const { body: payload, sessionToken, sessionExpiresAt } = await verifyJoinOtp(
        { ...body, phone: normalizePhone(body.phone) },
        otp,
      );

      res.cookie(FAMILY_SESSION_COOKIE_NAME, sessionToken, sessionCookieOptions(sessionExpiresAt));
      req.log?.info?.({ relationship: body.relationship }, 'family: member joined');
      res.json(familyJoinVerifyResponseSchema.parse(payload));
    } catch (e) {
      next(e);
    }
  });

  // ── Family side ───────────────────────────────────────────────────────────

  router.get('/me', async (req, res, next) => {
    try {
      noStore(res);
      const identity = await requireFamilyMember(req);
      res.json(familyMeResponseSchema.parse(familyMeBody(identity)));
    } catch (e) {
      next(e);
    }
  });

  router.get('/today', async (req, res, next) => {
    try {
      noStore(res);
      const identity = await requireFamilyMember(req);
      const body = await buildFamilyToday({
        userId: identity.userId,
        memberFirstName: identity.name.trim().split(/\s+/)[0] || 'there',
        patientFirstName: identity.patientName?.trim().split(/\s+/)[0] || 'She',
        completedToday: await hasActedToday(identity.memberId),
      });
      res.json(familyTodayResponseSchema.parse(body));
    } catch (e) {
      next(e);
    }
  });

  router.get('/learn', async (req, res, next) => {
    try {
      noStore(res);
      await requireFamilyMember(req);
      res.json(familyLearnResponseSchema.parse(buildFamilyLearn()));
    } catch (e) {
      next(e);
    }
  });

  router.get('/privacy', async (req, res, next) => {
    try {
      noStore(res);
      const identity = await requireFamilyMember(req);
      const her = identity.patientName?.trim().split(/\s+/)[0] || 'She';
      res.json(familyPrivacyResponseSchema.parse(buildFamilyPrivacy(her)));
    } catch (e) {
      next(e);
    }
  });

  router.post('/support-actions', async (req, res, next) => {
    try {
      noStore(res);
      const identity = await requireFamilyMember(req);
      const { kind } = familySupportActionBodySchema.parse(req.body);
      const result = await recordSupportAction({
        familyMemberId: identity.memberId,
        userId: identity.userId,
        kind,
      });
      req.log?.info?.({ kind }, 'family: support action recorded');
      res.json(familySupportActionResponseSchema.parse(result));
    } catch (e) {
      next(e);
    }
  });

  router.post('/support-actions/remind-later', async (req, res, next) => {
    try {
      noStore(res);
      const identity = await requireFamilyMember(req);
      res.json(familyRemindLaterResponseSchema.parse(await scheduleSupportReminder(identity.memberId)));
    } catch (e) {
      next(e);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      noStore(res);
      await destroyFamilySession(req);
      res.clearCookie(FAMILY_SESSION_COOKIE_NAME, sessionCookieOptions());
      res.json(familyLogoutResponseSchema.parse({ ok: true }));
    } catch (e) {
      next(e);
    }
  });

  // Module-local error handling, so a FamilyError surfaces as its intended status and the global
  // handler stays untouched.
  router.use(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (err: unknown, req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof FamilyError) {
        req.log?.warn?.({ status: err.status, code: err.code }, `family: ${err.message}`);
        res.status(err.status).json({ error: err.message, code: err.code });
        return;
      }

      // Anything carrying a numeric status came from the injected auth resolver — a 401 for an
      // expired session, typically. Pass its intent through.
      if (
        typeof err === 'object' &&
        err !== null &&
        typeof (err as { status?: unknown }).status === 'number'
      ) {
        const status = (err as { status: number }).status;
        const message = (err as { message?: unknown }).message ?? 'Request could not be completed.';
        res.status(status).json({ error: String(message) });
        return;
      }

      req.log?.error?.({ err }, 'family: unhandled failure');
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    },
  );

  return router;
}
