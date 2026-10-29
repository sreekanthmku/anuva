-- Links and members that predate itemized consent: the invite screen she agreed to then
-- (`FamilyInvite.consentVersion`) is counted as consent to the minimum sharing, so nothing changes for
-- families already connected. Recorded as `legacy:<that version>`, never as the current notice, so the
-- consent log says exactly what she saw. Only rows still without a version are touched, so a re-run
-- does nothing.

-- Pending links she may already have sent.
WITH filled AS (
  UPDATE "FamilyInvite"
     SET "coreSharingVersion" = 'legacy:' || "consentVersion"
   WHERE "status" = 'pending' AND "coreSharingVersion" IS NULL
  RETURNING "id", "userId", "coreSharingVersion"
)
INSERT INTO "FamilyShareConsent" ("id", "userId", "inviteId", "scope", "granted", "textVersion", "createdAt")
SELECT 'legacy' || md5(random()::text || clock_timestamp()::text || "id"), "userId", "id", 'core', true,
       "coreSharingVersion", CURRENT_TIMESTAMP
  FROM filled;

-- Everyone connected now, from the link they joined with (or plain `legacy` if that row is gone).
WITH filled AS (
  UPDATE "FamilyMember" AS m
     SET "coreSharingVersion" = COALESCE(
           (SELECT 'legacy:' || i."consentVersion" FROM "FamilyInvite" i WHERE i."memberId" = m."id"),
           'legacy'),
         "coreSharingAt" = m."createdAt"
   WHERE m."status" = 'active' AND m."coreSharingVersion" IS NULL
  RETURNING m."id", m."userId", m."coreSharingVersion"
)
INSERT INTO "FamilyShareConsent" ("id", "userId", "memberId", "scope", "granted", "textVersion", "createdAt")
SELECT 'legacy' || md5(random()::text || clock_timestamp()::text || "id"), "userId", "id", 'core', true,
       "coreSharingVersion", CURRENT_TIMESTAMP
  FROM filled;
