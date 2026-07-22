-- CreateEnum
CREATE TYPE "ConsultationCallProvider" AS ENUM ('livekit');

-- CreateEnum
CREATE TYPE "ConsultationCallStatus" AS ENUM ('waiting', 'active', 'ended', 'failed');

-- CreateEnum
CREATE TYPE "ConsultationRecordingStatus" AS ENUM ('starting', 'recording', 'processing', 'ready', 'failed');

-- CreateTable
CREATE TABLE "ConsultationCall" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "provider" "ConsultationCallProvider" NOT NULL DEFAULT 'livekit',
    "roomName" TEXT NOT NULL,
    "status" "ConsultationCallStatus" NOT NULL DEFAULT 'waiting',
    "doctorStartedAt" TIMESTAMP(3),
    "patientJoinedAt" TIMESTAMP(3),
    "recordingStartedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationRecording" (
    "id" TEXT NOT NULL,
    "consultationCallId" TEXT NOT NULL,
    "egressId" TEXT,
    "status" "ConsultationRecordingStatus" NOT NULL DEFAULT 'starting',
    "storagePath" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationCallConsent" (
    "id" TEXT NOT NULL,
    "consultationCallId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationCallConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationCall_consultationId_key" ON "ConsultationCall"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationCall_roomName_key" ON "ConsultationCall"("roomName");

-- CreateIndex
CREATE INDEX "ConsultationCall_status_idx" ON "ConsultationCall"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRecording_consultationCallId_key" ON "ConsultationRecording"("consultationCallId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRecording_egressId_key" ON "ConsultationRecording"("egressId");

-- CreateIndex
CREATE INDEX "ConsultationRecording_status_idx" ON "ConsultationRecording"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationCallConsent_consultationCallId_userId_key" ON "ConsultationCallConsent"("consultationCallId", "userId");

-- CreateIndex
CREATE INDEX "ConsultationCallConsent_userId_idx" ON "ConsultationCallConsent"("userId");

-- AddForeignKey
ALTER TABLE "ConsultationCall" ADD CONSTRAINT "ConsultationCall_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationRecording" ADD CONSTRAINT "ConsultationRecording_consultationCallId_fkey" FOREIGN KEY ("consultationCallId") REFERENCES "ConsultationCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationCallConsent" ADD CONSTRAINT "ConsultationCallConsent_consultationCallId_fkey" FOREIGN KEY ("consultationCallId") REFERENCES "ConsultationCall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationCallConsent" ADD CONSTRAINT "ConsultationCallConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
