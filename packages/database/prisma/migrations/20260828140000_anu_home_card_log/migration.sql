-- ANU home card impressions: cooldown state and tap-through measurement for the
-- rule-picked card on the home screen (see apps/api/src/homeCard/).
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AnuHomeCardLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shownAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 1,
    "tappedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnuHomeCardLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AnuHomeCardLog_userId_signalId_date_key" ON "AnuHomeCardLog"("userId", "signalId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnuHomeCardLog_userId_signalId_shownAt_idx" ON "AnuHomeCardLog"("userId", "signalId", "shownAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AnuHomeCardLog_signalId_date_idx" ON "AnuHomeCardLog"("signalId", "date");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "AnuHomeCardLog" ADD CONSTRAINT "AnuHomeCardLog_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
