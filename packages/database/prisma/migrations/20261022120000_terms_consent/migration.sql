-- Sign-up now requires agreeing to the Terms of Use and Privacy Policy. The agreement is stored in
-- the existing ConsentRecord ledger under a new purpose, with the version of the documents she saw.
--
-- IF NOT EXISTS: a database brought up with `db push` already carries the value.

-- AlterEnum
ALTER TYPE "ConsentPurpose" ADD VALUE IF NOT EXISTS 'terms_and_privacy';
