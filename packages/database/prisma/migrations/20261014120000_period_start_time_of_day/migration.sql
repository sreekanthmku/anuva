-- Whether a period started in the day or at night, asked when she logs its start.
--
-- Nullable: periods logged before the question existed have no answer.
-- IF NOT EXISTS: a database brought up with `db push` already has the column.

-- AlterTable
ALTER TABLE "PeriodLog" ADD COLUMN IF NOT EXISTS "startTimeOfDay" TEXT;
