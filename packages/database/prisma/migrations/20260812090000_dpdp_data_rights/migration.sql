-- AlterEnum
-- Two new OTP purposes: erasure and export both re-verify possession of the phone before running.
ALTER TYPE "OtpChallengePurpose" ADD VALUE 'account_deletion';
ALTER TYPE "OtpChallengePurpose" ADD VALUE 'data_export';

-- CreateEnum
CREATE TYPE "DataErasureScope" AS ENUM ('recordings', 'chat', 'tracker', 'account');

-- CreateEnum
CREATE TYPE "DataDeletionStatus" AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'failed');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'ready', 'downloaded', 'failed', 'expired');

-- AlterTable
-- Tombstone marker. Set only by a completed erasure; every auth path refuses a user carrying it.
ALTER TABLE "User" ADD COLUMN "erasedAt" TIMESTAMP(3);

-- AlterTable
-- End of the NMC three-year record floor, stamped when the patient asks to be erased.
ALTER TABLE "Consultation" ADD COLUMN "purgeAfter" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Consultation_purgeAfter_idx" ON "Consultation"("purgeAfter");

-- CreateTable
CREATE TABLE "DataDeletionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "phoneHash" TEXT NOT NULL,
    "scope" "DataErasureScope" NOT NULL,
    "status" "DataDeletionStatus" NOT NULL DEFAULT 'pending',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "itemCounts" JSONB,
    "failureReason" TEXT,

    CONSTRAINT "DataDeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DataExportRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "tokenHash" TEXT NOT NULL,
    "storagePath" TEXT,
    "sizeBytes" INTEGER,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataDeletionRequest_status_scheduledFor_idx" ON "DataDeletionRequest"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "DataDeletionRequest_userId_idx" ON "DataDeletionRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DataExportRequest_tokenHash_key" ON "DataExportRequest"("tokenHash");

-- CreateIndex
CREATE INDEX "DataExportRequest_userId_createdAt_idx" ON "DataExportRequest"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DataExportRequest_status_expiresAt_idx" ON "DataExportRequest"("status", "expiresAt");

-- AddForeignKey
-- SetNull, not Cascade: these rows are the proof an erasure was asked for and honoured, so they
-- have to outlive the data they destroyed.
ALTER TABLE "DataDeletionRequest" ADD CONSTRAINT "DataDeletionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataExportRequest" ADD CONSTRAINT "DataExportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
