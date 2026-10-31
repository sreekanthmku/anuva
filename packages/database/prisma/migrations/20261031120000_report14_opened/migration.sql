-- When she first opened her 14-day report. Null until then: Home guides her to the report once her
-- first 14 days are over, and stops once this is set.
--
-- IF NOT EXISTS: a database brought up with `db push` already carries the column, and
-- `migrate deploy` must not fail on it.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "report14OpenedAt" TIMESTAMP(3);
