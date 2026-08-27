-- One recorded support action per kind per day, rather than one per day.
--
-- A family member may message her and send flowers on the same day. The original unique index
-- collapsed those onto a single row, so the upsert overwrote `kind` and the first action was lost.
--
-- A separate migration rather than an edit to 20260827120000_family_sharing: that one may already
-- have been applied, and Prisma rejects a migration whose checksum changed after the fact.

-- DropIndex
DROP INDEX IF EXISTS "FamilySupportAction_familyMemberId_date_key";

-- CreateIndex
-- IF NOT EXISTS, unlike a Prisma-generated migration: a database that was brought up with
-- `db push` already carries this index from the schema, and `migrate deploy` must not fail on it.
CREATE UNIQUE INDEX IF NOT EXISTS "FamilySupportAction_familyMemberId_date_kind_key"
  ON "FamilySupportAction"("familyMemberId", "date", "kind");
