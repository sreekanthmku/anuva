-- CreateEnum
CREATE TYPE "ConsultationDocumentKind" AS ENUM ('prescription', 'diet_plan', 'other');

-- CreateTable
CREATE TABLE "ConsultationDocument" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "kind" "ConsultationDocumentKind" NOT NULL,
    "title" TEXT,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationDocument_consultationId_deletedAt_idx" ON "ConsultationDocument"("consultationId", "deletedAt");

-- AddForeignKey
ALTER TABLE "ConsultationDocument" ADD CONSTRAINT "ConsultationDocument_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationDocument" ADD CONSTRAINT "ConsultationDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
