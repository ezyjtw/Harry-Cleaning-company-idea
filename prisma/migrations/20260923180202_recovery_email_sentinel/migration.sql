-- Recovery Lane B row 7 (James-ruled): sentinel for the single pre-reap
-- payment-recovery email. Nullable, no backfill needed.
ALTER TABLE "Booking" ADD COLUMN "recoveryEmailSentAt" TIMESTAMP(3);
