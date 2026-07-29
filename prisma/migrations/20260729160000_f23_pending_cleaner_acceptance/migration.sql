-- F23 (James-ruled): recurring agreements require cleaner acceptance.
-- Agreements now enter PENDING_CLEANER_ACCEPTANCE at customer setup — nothing
-- charged, nothing minted — until the cleaner accepts within the 48h window.
-- DECLINED / EXPIRED are the no-money-ever-moved terminal states.

-- AlterEnum
ALTER TYPE "AgreementStatus" ADD VALUE 'PENDING_CLEANER_ACCEPTANCE';
ALTER TYPE "AgreementStatus" ADD VALUE 'DECLINED';
ALTER TYPE "AgreementStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "RecurringAgreement" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "proposedStartDate" DATE,
ADD COLUMN     "respondBy" TIMESTAMP(3),
ADD COLUMN     "trialBookingId" TEXT;

-- CreateIndex
CREATE INDEX "RecurringAgreement_status_respondBy_idx" ON "RecurringAgreement"("status", "respondBy");
