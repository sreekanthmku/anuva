-- AlterTable
ALTER TABLE "AnuChatTurn" ADD COLUMN     "suggestions" TEXT[];

-- AlterTable
ALTER TABLE "AnuResponseCache" ADD COLUMN     "suggestions" TEXT[];
