-- A returning family member re-opening a lapsed session. Their invite link is single-use and
-- already spent, so the phone verified at join is the credential; this purpose keeps those sends
-- distinguishable from an invite claim in the OtpChallenge table.
ALTER TYPE "OtpChallengePurpose" ADD VALUE IF NOT EXISTS 'family_signin';
