-- Period edit rules: predicted ends, reversible removal, flow owned by its period.

ALTER TABLE "PeriodLog" ADD COLUMN "endDateSource" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "PeriodLog" ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "PeriodFlowLog" ADD COLUMN "periodLogId" TEXT;

CREATE INDEX "PeriodLog_userId_deletedAt_idx" ON "PeriodLog"("userId", "deletedAt");
CREATE INDEX "PeriodFlowLog_periodLogId_idx" ON "PeriodFlowLog"("periodLogId");

ALTER TABLE "PeriodFlowLog"
  ADD CONSTRAINT "PeriodFlowLog_periodLogId_fkey"
  FOREIGN KEY ("periodLogId") REFERENCES "PeriodLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Give every unclosed period the end date we predict for it.
--
-- A period with no end date goes on claiming every day that follows it, so the
-- calendar keeps offering to end one she finished cycles ago. The predicted end
-- is her usual period length, but never shorter than the last day she recorded
-- flow for — if she answered for day seven, she bled for seven days and our
-- guess should not contradict her. Capped at the maximum period length, and
-- pulled back so it can never run into the period that follows it.
UPDATE "PeriodLog" p
SET "endDate" = sub.predicted_end,
    "endDateSource" = 'inferred'
FROM (
  SELECT
    open."id",
    LEAST(
      GREATEST(
        open."startDate" + ((COALESCE(cs."periodLength", 5) - 1) * INTERVAL '1 day'),
        COALESCE(
          (
            SELECT MAX(f."date")
            FROM "PeriodFlowLog" f
            WHERE f."userId" = open."userId"
              AND f."date" >= open."startDate"
              AND f."date" <= open."startDate" + INTERVAL '9 days'
          ),
          open."startDate"
        )
      ),
      -- Never longer than the maximum period length.
      open."startDate" + INTERVAL '9 days',
      -- Never into the next period she logged.
      COALESCE(
        (
          SELECT MIN(n."startDate")
          FROM "PeriodLog" n
          WHERE n."userId" = open."userId"
            AND n."startDate" > open."startDate"
        ) - INTERVAL '1 day',
        'infinity'::timestamp
      )
    )::date AS predicted_end
  FROM "PeriodLog" open
  LEFT JOIN "CycleSettings" cs ON cs."userId" = open."userId"
  WHERE open."endDate" IS NULL
) sub
WHERE p."id" = sub."id";

-- Attach each existing flow answer to the period whose span now contains it.
UPDATE "PeriodFlowLog" f
SET "periodLogId" = p."id"
FROM "PeriodLog" p
WHERE p."userId" = f."userId"
  AND f."date" >= p."startDate"
  AND f."date" <= COALESCE(p."endDate", p."startDate" + INTERVAL '9 days');
