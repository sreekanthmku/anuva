-- Optional language preference, learned from the client's Accept-Language. Nullable with no default:
-- a null reads as English, so existing rows need no backfill and nothing breaks for a client that
-- never sends a language.
ALTER TABLE "User" ADD COLUMN "preferredLanguage" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN "preferredLanguage" TEXT;
