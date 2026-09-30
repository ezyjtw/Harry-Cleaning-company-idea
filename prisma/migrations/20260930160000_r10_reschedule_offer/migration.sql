-- CreateTable
CREATE TABLE "RescheduleOffer" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "cleanerId" TEXT NOT NULL,
    "proposedDate" TIMESTAMP(3) NOT NULL,
    "proposedTime" TEXT NOT NULL,
    "originalDate" TIMESTAMP(3) NOT NULL,
    "originalTime" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'offered',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RescheduleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RescheduleOffer_bookingId_status_idx" ON "RescheduleOffer"("bookingId", "status");

-- CreateIndex
CREATE INDEX "RescheduleOffer_status_expiresAt_idx" ON "RescheduleOffer"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "RescheduleOffer" ADD CONSTRAINT "RescheduleOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

