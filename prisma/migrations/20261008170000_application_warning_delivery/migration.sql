-- AlterTable
ALTER TABLE "CleanerApplicationDraft" ADD COLUMN     "expiryReminderAttemptAt" TIMESTAMP(3),
ADD COLUMN     "expiryReminderFailures" INTEGER NOT NULL DEFAULT 0;

