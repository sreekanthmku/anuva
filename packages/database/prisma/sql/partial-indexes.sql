-- Partial unique indexes, which Prisma cannot express in schema.prisma and `prisma db push`
-- therefore never creates. Both rules below are reachable by two concurrent requests, so they are
-- enforced by the database and the routes handle the unique violation rather than pre-checking.
--
-- Run after any `db push` against a fresh database: `pnpm db:indexes` (the root `db:push` script
-- already chains it). The deployed database gets the same two indexes from the
-- 20260827120000_family_sharing migration.
--
-- Every statement here must be idempotent.

-- One active family member per woman.
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyMember_single_active"
  ON "FamilyMember"("userId") WHERE "status" = 'active';

-- One pending family invite per woman.
CREATE UNIQUE INDEX IF NOT EXISTS "FamilyInvite_single_pending"
  ON "FamilyInvite"("userId") WHERE "status" = 'pending';
