-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'FORTNIGHTLY');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('ACTIVE', 'ENDED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "AvailabilitySlot" ADD COLUMN     "recurringEligible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "agreementId" TEXT;

-- CreateTable
CREATE TABLE "RecurringAgreement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "guestEmail" TEXT,
    "guestName" TEXT,
    "cleanerId" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" DECIMAL(4,2) NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "addressCity" TEXT,
    "addressPostcode" TEXT NOT NULL,
    "rooms" JSONB,
    "notes" TEXT,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "platformFee" DECIMAL(10,2) NOT NULL,
    "cleanerEarnings" DECIMAL(10,2) NOT NULL,
    "status" "AgreementStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringAgreement_cleanerId_status_idx" ON "RecurringAgreement"("cleanerId", "status");

-- CreateIndex
CREATE INDEX "RecurringAgreement_clientId_idx" ON "RecurringAgreement"("clientId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "RecurringAgreement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAgreement" ADD CONSTRAINT "RecurringAgreement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringAgreement" ADD CONSTRAINT "RecurringAgreement_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

