-- The probe ladder: a five-rung authored question sequence in front of the classic
-- engine, for vague openers ("body pain", "not feeling myself"). See apps/api/src/anu/probe/.

-- A rung is authored text served verbatim with its options as chips, so it is neither a
-- model turn nor a cache hit and must not be counted as either in the routing stats.
ALTER TYPE "AnuTurnSource" ADD VALUE IF NOT EXISTS 'probe';

-- Existing rows were all served by the classic engine, and the DEFAULT backfills them as
-- such. That matters: `mode` is the thread boundary, so a NULL here would let the classic
-- engine treat a pre-ladder turn as belonging to a probe thread.
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'classic';

ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "probeRoot" TEXT;
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "probeAxis" TEXT;
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "probeDepth" INTEGER;
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "probeAnswers" JSONB;

-- Most women type rather than tap. A typed message the rung cannot resolve gets the rung
-- re-offered once rather than ending the ladder; the second one ends it, since by then she
-- has said twice over that she would rather talk than tap.
ALTER TABLE "AnuChatTurn" ADD COLUMN IF NOT EXISTS "probeHandbacks" INTEGER;
