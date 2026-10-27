-- "You missed yesterday" push: sent once, the next afternoon, for a day she did not track. The claim
-- lives on the missed day's own NudgeDailyState row.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- AlterTable
ALTER TABLE "NudgeDailyState" ADD COLUMN IF NOT EXISTS "missedReminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NudgeDailyState_date_lastEngagedAt_idx" ON "NudgeDailyState"("date", "lastEngagedAt");
