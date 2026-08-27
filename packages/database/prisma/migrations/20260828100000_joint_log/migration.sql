-- Joints & Stiffness tracker: one row per day, Track > Body.
--
-- No nudge writes this table — the tracker page is the only surface — so unlike the other daily
-- logs it carries no `category` column and its answer columns are named after its own questions.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "JointLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "severity" TEXT NOT NULL,
    "areas" TEXT[],
    "symptoms" TEXT[],
    "impact" TEXT,
    "timeOfDay" TEXT,
    "triggers" TEXT[],
    "score" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'tracker',
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JointLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "JointLog_userId_date_idx" ON "JointLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JointLog_userId_date_key" ON "JointLog"("userId", "date");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "JointLog" ADD CONSTRAINT "JointLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
