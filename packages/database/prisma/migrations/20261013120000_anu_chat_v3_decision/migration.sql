-- ANU v3: the structured decision behind each v3 turn (safety classification, risk level, intent,
-- offered action). Additive and nullable — classic and probe turns never write it.

-- AlterTable
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "decision" JSONB;
