-- AlterTable
ALTER TABLE "Specialist" ADD COLUMN     "accessKeyHash" TEXT,
ADD COLUMN     "accessKeyUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Specialist_accessKeyHash_key" ON "Specialist"("accessKeyHash");
