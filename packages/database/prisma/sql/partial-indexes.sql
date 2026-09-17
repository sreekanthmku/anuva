-- Partial unique indexes, which Prisma cannot express in schema.prisma and `prisma db push`
-- therefore never creates. The rule below is reachable by two concurrent requests, so it is
-- enforced by the database and the routes handle the unique violation rather than pre-checking.
--
-- Run after any `db push` against a fresh database: `pnpm db:indexes` (the root `db:push` script
-- already chains it). The deployed database reaches the same state through the
-- 20260827120000_family_sharing and 20260917120000_family_nudges migrations.
--
-- Every statement here must be idempotent.

-- Dropped in 20260917120000_family_nudges, and dropped here too so a database built by `db push`
-- matches a migrated one. It capped a woman at one connected family member; the cap is now
-- `FAMILY_MAX_MEMBERS` in application code, because the nudge corpus is written for a partner, a
-- teen and a caregiver and one slot could only ever serve one of them.
--
-- The race it guarded is still closed: a member is only ever created by claiming an invite, the
-- index below allows one outstanding invite per woman, and the claim is guarded on
-- `status = 'pending'` inside a transaction — so two people racing the same link still produce
-- exactly one member.
DROP INDEX IF EXISTS "FamilyMember_single_active";

-- One pending family invite per woman.
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyInvite_single_pending"
  ON "FamilyInvite"("userId") WHERE "status" = 'pending';
