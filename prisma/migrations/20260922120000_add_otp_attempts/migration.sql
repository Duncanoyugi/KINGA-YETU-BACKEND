-- Add attempt-tracking to OTPs so brute-force guessing can be blocked
-- server-side (in addition to the request-rate throttling added in
-- src/main.ts / src/app.module.ts). A code is invalidated once it has
-- been guessed incorrectly MAX_OTP_ATTEMPTS (5) times, even if it has
-- not yet expired.
ALTER TABLE "otps" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
