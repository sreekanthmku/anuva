-- CreateEnum
CREATE TYPE "ConsultationRecordingRole" AS ENUM ('doctor', 'patient');

-- DropIndex
DROP INDEX "ConsultationRecording_consultationCallId_key";

-- AlterTable
ALTER TABLE "ConsultationRecording" ADD COLUMN     "participantIdentity" TEXT NOT NULL,
ADD COLUMN     "participantRole" "ConsultationRecordingRole" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationRecording_consultationCallId_participantRole_key" ON "ConsultationRecording"("consultationCallId", "participantRole");

