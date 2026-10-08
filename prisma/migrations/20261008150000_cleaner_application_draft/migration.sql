-- CreateEnum
CREATE TYPE "CleanerApplicationStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "DocumentStorageState" AS ENUM ('PENDING', 'STORED', 'DELETED');

-- CreateEnum
CREATE TYPE "DocumentReviewState" AS ENUM ('DRAFT', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "DocumentUpload" ADD COLUMN     "reviewState" "DocumentReviewState" NOT NULL DEFAULT 'SUBMITTED',
ADD COLUMN     "storageState" "DocumentStorageState" NOT NULL DEFAULT 'STORED';

-- CreateTable
CREATE TABLE "CleanerApplicationDraft" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "CleanerApplicationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "maxReachedStep" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "dateOfBirth" DATE,
    "version" INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inactivityReminderSentAt" TIMESTAMP(3),
    "expiryReminderSentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CleanerApplicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanerVetting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CleanerVetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CleanerApplicationDraft_userId_key" ON "CleanerApplicationDraft"("userId");

-- CreateIndex
CREATE INDEX "CleanerApplicationDraft_status_lastActivityAt_idx" ON "CleanerApplicationDraft"("status", "lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "CleanerVetting_userId_key" ON "CleanerVetting"("userId");

-- CreateIndex
CREATE INDEX "DocumentUpload_storageState_createdAt_idx" ON "DocumentUpload"("storageState", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentUpload_userId_reviewState_idx" ON "DocumentUpload"("userId", "reviewState");

-- AddForeignKey
ALTER TABLE "CleanerApplicationDraft" ADD CONSTRAINT "CleanerApplicationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerVetting" ADD CONSTRAINT "CleanerVetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- RENA-101 backfill (new columns only; no existing value changes). Existing
-- rows keep the defaults STORED and SUBMITTED, then take the review state
-- their own columns already prove, and a destroyed row records that its
-- object was removed (destroyDocument deletes the object before marking).
UPDATE "DocumentUpload" SET "reviewState" = 'VERIFIED' WHERE "isVerified" = true;
UPDATE "DocumentUpload" SET "reviewState" = 'REJECTED' WHERE "isVerified" = false AND "rejectedAt" IS NOT NULL;
UPDATE "DocumentUpload" SET "storageState" = 'DELETED' WHERE "isDestroyed" = true;

-- RENA-101: exactly one active draft document per category per applicant. A
-- replacement's new row is PENDING until stored, so it never collides; the
-- swap to STORED and the old row's destroy happen in one transaction.
CREATE UNIQUE INDEX "DocumentUpload_one_active_draft_per_category"
  ON "DocumentUpload"("userId", "documentType")
  WHERE "reviewState" = 'DRAFT' AND "storageState" = 'STORED' AND "isDestroyed" = false;
