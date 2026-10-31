-- Weekly and monthly report notices: one row per user, period and period start, claimed before the
-- push is sent so it goes out once.
--
-- IF NOT EXISTS / duplicate_object guards: a database brought up with `db push` already carries
-- these objects, and `migrate deploy` must not fail on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "PeriodReportNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodReportNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PeriodReportNotice_userId_period_periodStart_key" ON "PeriodReportNotice"("userId", "period", "periodStart");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PeriodReportNotice" ADD CONSTRAINT "PeriodReportNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
