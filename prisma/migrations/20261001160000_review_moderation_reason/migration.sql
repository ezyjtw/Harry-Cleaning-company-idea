-- Reviews ruling (James): moderation actions carry a stated reason, stored on the record.
ALTER TABLE "Review" ADD COLUMN "moderationReason" TEXT;
