-- Per-day period flow intensity: light | regular | heavy.
--
-- One row per bleeding day, keyed [userId, date] like every other daily tracker log, so the
-- in-app prompt can upsert an answer and a correction lands on the same row.
--
-- A separate table rather than `PeriodDailyStatus`: that column is reserved for the L1-006
-- "did you bleed today" nudge answer, and report14/data/load.ts regex-tests its category to
-- decide whether a bleeding day happened. Flow values would not match that test.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PeriodFlowLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "flow" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'prompt',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodFlowLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PeriodFlowLog_userId_date_idx" ON "PeriodFlowLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PeriodFlowLog_userId_date_key" ON "PeriodFlowLog"("userId", "date");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "PeriodFlowLog" ADD CONSTRAINT "PeriodFlowLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
