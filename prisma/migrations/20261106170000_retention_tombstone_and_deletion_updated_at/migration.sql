-- B7.3 (RENA-063) and B7.5 (RENA-065): expand only.
-- User.retentionTombstonedAt: set once the six year tombstone has run (idempotence, visibility).
-- DataDeletionRequest.updatedAt: the IN_PROGRESS age anchor for the stalled-run recovery;
-- existing rows take the current time, which can only delay a recovery, never hasten one.
ALTER TABLE "User" ADD COLUMN "retentionTombstonedAt" TIMESTAMP(3);
ALTER TABLE "DataDeletionRequest" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
