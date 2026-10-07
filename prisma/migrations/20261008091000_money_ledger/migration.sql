-- B4 money ledger (RENA-010, 011, 013, 015, 017, 073, 075, 087 to 095).
--
-- Additive: every new column is nullable or defaulted and every new table is
-- new, so the previous code runs against this schema. Booking.stripeTransferId
-- and RefundRecord.allocation stay populated (read only by this backfill) and
-- are dropped in B9.
--
-- Legacy data is never guessed (James-ruled). Adopted legacy transfers migrate
-- NEEDS_RECONCILE with null amounts until Stripe is read. A legacy refund is
-- not proof of executed money: a slice with a stored Stripe refund id migrates
-- NEEDS_RECONCILE (read back by that id), a slice with none migrates UNKNOWN
-- (reconciled by payment intent and the record id in the refund metadata), and
-- only a definitive legacy failure with no Stripe id migrates FAILED. No
-- booking payment state is rewritten here: the post-deploy reconciliation
-- recomputes it once every slice of the booking is known. The migration calls
-- no API.

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "amountShortfallPence" INTEGER,
ADD COLUMN     "chargeIdempotencyKey" TEXT,
ADD COLUMN     "chargeNextReconcileAt" TIMESTAMP(3),
ADD COLUMN     "chargeOutcomeUnknownAt" TIMESTAMP(3),
ADD COLUMN     "chargeReconcileCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reassignRevertConflictAt" TIMESTAMP(3),
ADD COLUMN     "shortfallAcceptReason" TEXT,
ADD COLUMN     "shortfallAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "shortfallAcceptedById" TEXT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "lastMoneyError" TEXT,
ADD COLUMN     "moneyStepLockedAt" TIMESTAMP(3),
ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "refundRecordId" TEXT,
ADD COLUMN     "resolutionAmountPence" INTEGER,
ADD COLUMN     "resolutionOutcome" TEXT,
ADD COLUMN     "resolvedById" TEXT,
ADD COLUMN     "resolvingSince" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "RefundRecord" ADD COLUMN     "context" JSONB,
ADD COLUMN     "executedPence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "finalizedExecutedPence" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "requestedPence" INTEGER;

-- AlterTable
ALTER TABLE "ServiceAddon" ADD COLUMN     "cleanerSharePct" DECIMAL(5,4);

-- AlterTable
ALTER TABLE "TopupRecord" ADD COLUMN     "stripeChargeId" TEXT;

-- CreateTable
CREATE TABLE "TransferSlice" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stripeTransferId" TEXT NOT NULL,
    "amountPence" INTEGER,
    "reversedPence" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL,
    "sourceChargeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "idempotencyKey" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "lastReconcileResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferSlice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferReversal" (
    "id" TEXT NOT NULL,
    "transferSliceId" TEXT NOT NULL,
    "refundRecordId" TEXT NOT NULL,
    "stripeReversalId" TEXT,
    "amountPence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "lastReconcileResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransferReversal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundSlice" (
    "id" TEXT NOT NULL,
    "refundRecordId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "requestedPence" INTEGER NOT NULL,
    "executedPence" INTEGER NOT NULL DEFAULT 0,
    "stripeRefundId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "lastReconcileResult" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefundSlice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargebackHold" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "stripeChargeId" TEXT,
    "amountPence" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChargebackHold_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferSlice_stripeTransferId_key" ON "TransferSlice"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferSlice_idempotencyKey_key" ON "TransferSlice"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferSlice_bookingId_idx" ON "TransferSlice"("bookingId");

-- CreateIndex
CREATE INDEX "TransferSlice_status_idx" ON "TransferSlice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransferReversal_stripeReversalId_key" ON "TransferReversal"("stripeReversalId");

-- CreateIndex
CREATE UNIQUE INDEX "TransferReversal_idempotencyKey_key" ON "TransferReversal"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TransferReversal_refundRecordId_idx" ON "TransferReversal"("refundRecordId");

-- CreateIndex
CREATE INDEX "TransferReversal_status_idx" ON "TransferReversal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RefundSlice_stripeRefundId_key" ON "RefundSlice"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundSlice_idempotencyKey_key" ON "RefundSlice"("idempotencyKey");

-- CreateIndex
CREATE INDEX "RefundSlice_refundRecordId_idx" ON "RefundSlice"("refundRecordId");

-- CreateIndex
CREATE INDEX "RefundSlice_status_idx" ON "RefundSlice"("status");

-- CreateIndex
CREATE INDEX "RefundSlice_stripePaymentIntentId_idx" ON "RefundSlice"("stripePaymentIntentId");

-- CreateIndex
CREATE UNIQUE INDEX "ChargebackHold_stripeDisputeId_key" ON "ChargebackHold"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "ChargebackHold_bookingId_idx" ON "ChargebackHold"("bookingId");

-- CreateIndex
CREATE INDEX "ChargebackHold_status_idx" ON "ChargebackHold"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TopupRecord_stripeChargeId_key" ON "TopupRecord"("stripeChargeId");

-- AddForeignKey
ALTER TABLE "TransferSlice" ADD CONSTRAINT "TransferSlice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferReversal" ADD CONSTRAINT "TransferReversal_transferSliceId_fkey" FOREIGN KEY ("transferSliceId") REFERENCES "TransferSlice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundSlice" ADD CONSTRAINT "RefundSlice_refundRecordId_fkey" FOREIGN KEY ("refundRecordId") REFERENCES "RefundRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargebackHold" ADD CONSTRAINT "ChargebackHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Backfill (idempotent: ON CONFLICT DO NOTHING, guarded updates) ─────────

-- TransferSlice: one ADOPTED row per legacy transfer id (comma-joined values
-- split), amount unknown until Stripe is read.
INSERT INTO "TransferSlice" ("id", "bookingId", "stripeTransferId", "amountPence", "kind", "status", "lastReconcileResult", "updatedAt")
SELECT 'legacy_ts_' || md5(b."id" || ':' || btrim(t.tid)),
       b."id",
       btrim(t.tid),
       NULL,
       'ADOPTED',
       'NEEDS_RECONCILE',
       'MIGRATED: amount unknown until Stripe is read',
       CURRENT_TIMESTAMP
FROM "Booking" b,
     LATERAL unnest(string_to_array(b."stripeTransferId", ',')) AS t(tid)
WHERE b."stripeTransferId" IS NOT NULL
  AND btrim(t.tid) <> ''
ON CONFLICT DO NOTHING;

-- RefundRecord.requestedPence from the legacy amount.
UPDATE "RefundRecord"
SET "requestedPence" = round("amount" * 100)::int
WHERE "requestedPence" IS NULL;

-- RefundSlice from the allocation JSON ([{ pi, refundId, amountPence }]).
INSERT INTO "RefundSlice" ("id", "refundRecordId", "stripePaymentIntentId", "requestedPence", "executedPence", "stripeRefundId", "status", "idempotencyKey", "lastReconcileResult", "updatedAt")
SELECT 'legacy_rs_' || md5(r."id" || ':' || a.ord),
       r."id",
       a.elem ->> 'pi',
       (a.elem ->> 'amountPence')::int,
       0,
       NULLIF(a.elem ->> 'refundId', ''),
       CASE WHEN NULLIF(a.elem ->> 'refundId', '') IS NOT NULL THEN 'NEEDS_RECONCILE' ELSE 'UNKNOWN' END,
       'legacy_' || r."id" || '_s' || a.ord,
       'MIGRATED: legacy allocation entry, not yet read from Stripe',
       CURRENT_TIMESTAMP
FROM "RefundRecord" r,
     LATERAL jsonb_array_elements(r."allocation") WITH ORDINALITY AS a(elem, ord)
WHERE jsonb_typeof(r."allocation") = 'array'
  AND jsonb_array_length(r."allocation") > 0
  AND (a.elem ->> 'pi') IS NOT NULL
  AND (a.elem ->> 'amountPence') ~ '^[0-9]+$'
ON CONFLICT DO NOTHING;

-- RefundSlice for legacy records with no allocation: one slice on the
-- booking's PaymentIntent (every pre-allocation refund hit the original).
INSERT INTO "RefundSlice" ("id", "refundRecordId", "stripePaymentIntentId", "requestedPence", "executedPence", "stripeRefundId", "status", "idempotencyKey", "lastReconcileResult", "updatedAt")
SELECT 'legacy_rs_' || md5(r."id" || ':0'),
       r."id",
       b."stripePaymentIntentId",
       round(r."amount" * 100)::int,
       0,
       r."stripeRefundId",
       CASE
         WHEN r."stripeRefundId" IS NOT NULL THEN 'NEEDS_RECONCILE'
         WHEN r."status" IN ('FAILED', 'REVERSAL_ONLY') THEN 'FAILED'
         ELSE 'UNKNOWN'
       END,
       'legacy_' || r."id" || '_s0',
       CASE
         WHEN r."stripeRefundId" IS NULL AND r."status" IN ('FAILED', 'REVERSAL_ONLY')
           THEN 'MIGRATED: definitive legacy failure, no Stripe refund id'
         ELSE 'MIGRATED: legacy record, not yet read from Stripe'
       END,
       CURRENT_TIMESTAMP
FROM "RefundRecord" r
JOIN "Booking" b ON b."id" = r."bookingId"
WHERE (r."allocation" IS NULL OR jsonb_typeof(r."allocation") <> 'array' OR jsonb_array_length(r."allocation") = 0)
  AND b."stripePaymentIntentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "RefundSlice" s WHERE s."refundRecordId" = r."id")
ON CONFLICT DO NOTHING;

-- Catch-all: a legacy record still without a slice (its refund id is already
-- held by another slice, so the unique id refused it) gets one slice with no
-- refund id, NEEDS_RECONCILE, matched later by payment intent and record id
-- or by an admin. Never left out of the ledger, never guessed.
INSERT INTO "RefundSlice" ("id", "refundRecordId", "stripePaymentIntentId", "requestedPence", "executedPence", "stripeRefundId", "status", "idempotencyKey", "lastReconcileResult", "updatedAt")
SELECT 'legacy_rs_' || md5(r."id" || ':orphan'),
       r."id",
       b."stripePaymentIntentId",
       round(r."amount" * 100)::int,
       0,
       NULL,
       CASE WHEN r."status" IN ('FAILED', 'REVERSAL_ONLY') AND r."stripeRefundId" IS NULL THEN 'FAILED' ELSE 'NEEDS_RECONCILE' END,
       'legacy_' || r."id" || '_orphan',
       'MIGRATED: refund id shared with another record; to be matched by payment intent',
       CURRENT_TIMESTAMP
FROM "RefundRecord" r
JOIN "Booking" b ON b."id" = r."bookingId"
WHERE b."stripePaymentIntentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "RefundSlice" s WHERE s."refundRecordId" = r."id")
ON CONFLICT DO NOTHING;

-- RENA-075 (D-n): the misleading fee controls go; the rates live in
-- src/lib/pricing/rates.ts only.
DELETE FROM "PlatformConfig" WHERE "key" IN ('cleaner_fee_pct', 'customer_fee_pct');
