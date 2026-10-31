-- The minimum-sharing box must start unticked: she ticks it herself for each link before it can be
-- sent. The backfill in 20261029120100 ticked every link pending at the time, and since she always
-- has a pending link waiting, most people found it already ticked.
--
-- Unticked again here, but only where that backfill ticked it (`legacy:` version) and the link was
-- never sent (`sharedAt` is null). A link she already sent keeps it: whoever holds that link must
-- still be able to join. Each untick is logged as a withdrawal, the same as unticking it in the app
-- (`updateInviteChoice`). Only legacy-ticked unsent rows are touched, so a re-run does nothing.

WITH cleared AS (
  UPDATE "FamilyInvite"
     SET "coreSharingVersion" = NULL
   WHERE "status" = 'pending'
     AND "sharedAt" IS NULL
     AND "coreSharingVersion" LIKE 'legacy:%'
  RETURNING "id", "userId"
)
INSERT INTO "FamilyShareConsent" ("id", "userId", "inviteId", "scope", "granted", "textVersion", "createdAt")
SELECT 'untick' || md5(random()::text || clock_timestamp()::text || "id"), "userId", "id", 'core', false,
       NULL, CURRENT_TIMESTAMP
  FROM cleared;
