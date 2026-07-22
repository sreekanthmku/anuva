-- CreateEnum
CREATE TYPE "AnuTurnSource" AS ENUM ('red_flag', 'cache', 'model');

-- CreateTable
CREATE TABLE "AnuChatTurn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userMessage" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "source" "AnuTurnSource" NOT NULL,
    "redFlagArea" TEXT,
    "cacheHitId" TEXT,
    "similarity" DOUBLE PRECISION,
    "promptVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnuChatTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnuResponseCache" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reply" TEXT NOT NULL,
    "embedding" BYTEA NOT NULL,
    "promptVersion" INTEGER NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnuResponseCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnuChatTurn_userId_createdAt_idx" ON "AnuChatTurn"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnuChatTurn_createdAt_idx" ON "AnuChatTurn"("createdAt");

-- CreateIndex
CREATE INDEX "AnuResponseCache_promptVersion_idx" ON "AnuResponseCache"("promptVersion");

-- CreateIndex
CREATE INDEX "AnuResponseCache_lastUsedAt_idx" ON "AnuResponseCache"("lastUsedAt");

-- AddForeignKey
ALTER TABLE "AnuChatTurn" ADD CONSTRAINT "AnuChatTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
