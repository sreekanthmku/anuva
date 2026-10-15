-- Notes for the doctor: typed, spoken or photographed, private until she shares one with a
-- consultation. Sharing freezes the text on `HealthNoteShare` together with the consent she gave.
-- `ConsentRecord` holds her consent to send voice notes and photos to OpenAI for transcription.
--
-- IF NOT EXISTS throughout: a database brought up with `db push` already carries these objects
-- from the schema, and `migrate deploy` must not fail on them.

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "HealthNoteSource" AS ENUM ('text', 'voice', 'photo');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "HealthNoteStatus" AS ENUM ('draft', 'ready', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "HealthNoteAttachmentKind" AS ENUM ('audio', 'image');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "ConsentPurpose" AS ENUM ('note_ai_processing');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HealthNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "HealthNoteSource" NOT NULL,
    "status" "HealthNoteStatus" NOT NULL DEFAULT 'ready',
    "body" TEXT,
    "rawText" TEXT,
    "unclear" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT,
    "aiUsage" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "HealthNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HealthNoteAttachment" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "kind" "HealthNoteAttachmentKind" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "HealthNoteAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HealthNoteShare" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "snapshotBody" TEXT NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

CONSTRAINT "HealthNoteShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ConsentPurpose" NOT NULL,
    "textVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthNote_userId_deletedAt_createdAt_idx" ON "HealthNote"("userId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthNote_status_createdAt_idx" ON "HealthNote"("status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthNoteAttachment_noteId_idx" ON "HealthNoteAttachment"("noteId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HealthNoteShare_consultationId_revokedAt_idx" ON "HealthNoteShare"("consultationId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HealthNoteShare_noteId_consultationId_key" ON "HealthNoteShare"("noteId", "consultationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ConsentRecord_userId_purpose_grantedAt_idx" ON "ConsentRecord"("userId", "purpose", "grantedAt");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "HealthNote" ADD CONSTRAINT "HealthNote_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "HealthNoteAttachment" ADD CONSTRAINT "HealthNoteAttachment_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "HealthNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "HealthNoteShare" ADD CONSTRAINT "HealthNoteShare_noteId_fkey"
      FOREIGN KEY ("noteId") REFERENCES "HealthNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "HealthNoteShare" ADD CONSTRAINT "HealthNoteShare_consultationId_fkey"
      FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
