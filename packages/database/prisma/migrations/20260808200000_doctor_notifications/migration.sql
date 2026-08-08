-- Doctor portal notifications: an in-app feed plus the push tokens to deliver them to devices.

-- CreateEnum
CREATE TYPE "DoctorNotificationType" AS ENUM ('consultation_booked', 'consultation_cancelled', 'consultation_rescheduled', 'question_asked');

-- CreateTable
CREATE TABLE "SpecialistFcmToken" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "FcmPlatform" NOT NULL,
    "status" "FcmTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "deviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpecialistFcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorNotification" (
    "id" TEXT NOT NULL,
    "specialistId" TEXT NOT NULL,
    "type" "DoctorNotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "consultationId" TEXT,
    "questionId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpecialistFcmToken_token_key" ON "SpecialistFcmToken"("token");

-- CreateIndex
CREATE INDEX "SpecialistFcmToken_specialistId_status_idx" ON "SpecialistFcmToken"("specialistId", "status");

-- CreateIndex
CREATE INDEX "DoctorNotification_specialistId_createdAt_idx" ON "DoctorNotification"("specialistId", "createdAt");

-- CreateIndex
CREATE INDEX "DoctorNotification_specialistId_readAt_idx" ON "DoctorNotification"("specialistId", "readAt");

-- AddForeignKey
ALTER TABLE "SpecialistFcmToken" ADD CONSTRAINT "SpecialistFcmToken_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorNotification" ADD CONSTRAINT "DoctorNotification_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
