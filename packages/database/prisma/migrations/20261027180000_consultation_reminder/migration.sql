-- A push to her shortly before a consultation starts. `reminderSentFor` holds the start time the
-- reminder was handled for, so a reschedule makes it due again for the new slot. Null for every
-- existing booking, so upcoming ones get their reminder after this deploys.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN IF NOT EXISTS "reminderSentFor" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Consultation_status_scheduledAt_idx" ON "Consultation"("status", "scheduledAt");
