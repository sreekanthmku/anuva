-- Hard-deletes ONE patient account and everything it created. Cannot be undone.
-- (A patient's own "delete my account" request is privacy/erasure.ts, which keeps clinical records.)
--
-- Run through scripts/delete-user.sh, or directly:
--   psql "$DATABASE_URL" -v user_id='<userId>' -f scripts/delete-user.sql
--
-- Deleting the "User" row cascades almost everything (logs, assessments, chats, consultations and
-- their calls/notes/documents, family members and their sessions/devices, consents, reminders…).
-- The statements before it handle what does not cascade, so nothing is left behind detached.
-- Files on the API server's disk (recordings, note photos, consultation documents, exports) are not
-- touched by SQL.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE del_user ON COMMIT DROP AS
  SELECT id, phone FROM "User" WHERE id = :'user_id';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM del_user) THEN
    RAISE EXCEPTION 'No user with that id. Nothing deleted.';
  END IF;
END $$;

CREATE TEMP TABLE del_consultation ON COMMIT DROP AS
  SELECT id FROM "Consultation" WHERE "userId" IN (SELECT id FROM del_user);

CREATE TEMP TABLE del_member ON COMMIT DROP AS
  SELECT id, phone FROM "FamilyMember" WHERE "userId" IN (SELECT id FROM del_user);

-- Free her booked slots, or those times stay "booked" by a consultation that no longer exists.
UPDATE "ConsultationSlot"
   SET "isBooked" = false, "consultationId" = NULL
 WHERE "consultationId" IN (SELECT id FROM del_consultation);

-- Doctor notifications name the patient and have no link that cascades.
DELETE FROM "DoctorNotification" WHERE "consultationId" IN (SELECT id FROM del_consultation);

-- These would be detached (SET NULL) instead of deleted; remove them outright.
DELETE FROM "LoginSession"
 WHERE "userId" IN (SELECT id FROM del_user)
    OR "familyMemberId" IN (SELECT id FROM del_member);
DELETE FROM "OtpChallenge"
 WHERE "userId" IN (SELECT id FROM del_user)
    OR phone IN (SELECT phone FROM del_user UNION SELECT phone FROM del_member);
DELETE FROM "AnonymousQuestion"   WHERE "userId" IN (SELECT id FROM del_user);
DELETE FROM "SupportTicket"       WHERE "userId" IN (SELECT id FROM del_user);
DELETE FROM "DataDeletionRequest" WHERE "userId" IN (SELECT id FROM del_user);
DELETE FROM "DataExportRequest"   WHERE "userId" IN (SELECT id FROM del_user);

-- Everything else cascades from the account.
DELETE FROM "User" WHERE id IN (SELECT id FROM del_user);

COMMIT;
