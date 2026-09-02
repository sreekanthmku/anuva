-- Period edit rules: inferred ends, reversible removal, flow owned by its period.

ALTER TABLE "PeriodLog" ADD COLUMN "endDateSource" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "PeriodLog" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "PeriodFlowLog" ADD COLUMN "periodLogId" TEXT;

CREATE INDEX "PeriodLog_userId_deletedAt_idx" ON "PeriodLog"("userId", "deletedAt");
CREATE INDEX "PeriodFlowLog_periodLogId_idx" ON "PeriodFlowLog"("periodLogId");

ALTER TABLE "PeriodFlowLog"
  ADD CONSTRAINT "PeriodFlowLog_periodLogId_fkey"
  FOREIGN KEY ("periodLogId") REFERENCES "PeriodLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: attach each existing flow answer to the period whose span contains its
-- day. An open period is treated as running 10 days (the maximum period length),
-- which is the widest span a flow answer could legitimately have been written in.
UPDATE "PeriodFlowLog" f
SET "periodLogId" = p."id"
FROM "PeriodLog" p
WHERE p."userId" = f."userId"
  AND f."date" >= p."startDate"
  AND f."date" <= COALESCE(p."endDate", p."startDate" + INTERVAL '9 days');
