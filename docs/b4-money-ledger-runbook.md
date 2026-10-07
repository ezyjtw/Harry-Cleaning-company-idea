# B4 money ledger: deploy, reconciliation and rollback runbook

Batch B4 (RENA-010, 011, 013, 015, 016, 017, 073, 075, 080, 087 to 095).
Design and rulings: docs/design/B4.md. Every step that touches Railway,
Stripe or production data runs only on James's explicit word.

## 1. What the deploy does

`railway.json` runs `prisma migrate deploy` before the server starts. Two
migrations apply:

1. `20261008090000_dispute_resolving_enum`: adds `RESOLVING_REFUND` and
   `RESOLVING_RELEASE` to `DisputeStatus`.
2. `20261008091000_money_ledger`: additive tables and columns
   (`TransferSlice`, `TransferReversal`, `RefundSlice`, `ChargebackHold`, the
   new Booking, RefundRecord, TopupRecord, Dispute and ServiceAddon columns),
   then an idempotent backfill:
   - every legacy `Booking.stripeTransferId` (comma-joined values split)
     becomes an ADOPTED `TransferSlice`, status NEEDS_RECONCILE, amount null;
   - every legacy `RefundRecord` gets slices: NEEDS_RECONCILE where a Stripe
     refund id is stored, UNKNOWN where none is, FAILED only for a definitive
     legacy failure with no Stripe id; executed money is 0 until Stripe is
     read (legacy SUCCEEDED is not proof of executed money, James-ruled);
   - the `cleaner_fee_pct` and `customer_fee_pct` PlatformConfig rows are
     deleted.
     No booking payment or transfer state is rewritten. The migration calls no
     API. Rehearsal: `scripts/b4-migration-rehearsal.sh` (production-shaped
     legacy rows, run twice, backfill re-run for idempotence).

The reference seed then runs; PlatformConfig defaults are create-if-missing
(N8), so an admin's edit is never reset by a deploy.

## 2. After the deploy (server side, read only against Stripe)

Three scheduler jobs ride the existing lease on every tick:

- `transferSliceReconcile`: fills NEEDS_RECONCILE transfer slices from
  `stripe.transfers.retrieve` (50 per tick, backoff 2m, 2m, 5m, 15m, 60m, 4h).
- `refundReconcile`: reads unresolved refund slices and reversals from
  Stripe (refund id, or the payment intent's refunds matched by metadata),
  writes SUCCEEDED or FAILED, never re-executes. A slice is FAILED only when
  it is over 24 hours old and the intent carries no unmatched refund;
  otherwise it stays NEEDS_RECONCILE for an admin.
- `disputeMoneyRetries`: re-runs the money step of RESOLVING disputes.

Until a booking's legacy slices are read, refunds on that booking answer
LEDGER_RECONCILIATION_PENDING and its stuck-money rows show
LEGACY_RECONCILE or SLICE_NEEDS_RECONCILE. Expect these to drain within a
few ticks of the deploy; a row marked persistent means six reads failed.

Watch after deploy: the stuck-money page (`/admin/bookings/stuck-money`),
log lines `refund slice_reconcile_threw`, `transfer release_unknown`,
`scheduler money_job_failed`, and the scheduler summary keys
`transferSliceReconcile`, `refundReconcile`, `disputeMoneyRetries`.

## 3. Stripe dashboard configuration (James-side, on his word)

The platform webhook destination (`STRIPE_WEBHOOK_SECRET_PLATFORM`) must
also send `charge.dispute.created` and `charge.dispute.closed` for the N7
chargeback hold. `charge.refunded` is already sent. Without the two dispute
events the code is inert for chargebacks (no hold is ever opened).

## 4. Rollback

Rollback is NOT automatically safe once the new code has made its first
new-format money mutation (James-ruled wording). After that point:

- a refund made by the new code is recorded as RefundRecord plus RefundSlice
  rows; the old code reads only `RefundRecord.amount` with status SUCCEEDED,
  so a PARTIAL record (requested more than executed) would be overstated by
  the old remainder arithmetic, and a refund still UNKNOWN or PENDING would
  be invisible to it;
- a payout made by the new code may be several transfer slices (one per
  charge); the old code mirrors only the first id in
  `Booking.stripeTransferId` and its post-release refund reverses that one
  transfer only;
- a dispute in RESOLVING_REFUND or RESOLVING_RELEASE is a status the old
  code does not know (nor RefundRecord status RETRYING or PARTIAL);
- a booking held by a chargeback or a shortfall sits PAUSED; the old code
  has no way to resume it except dispute resolution or break-glass.
- a shortfall is lifted only by the admin's "Accept shortfall and release"
  (gate ruling 5), recorded in three new nullable Booking columns
  (`shortfallAcceptedAt`, `shortfallAcceptedById`, `shortfallAcceptReason`)
  beside `amountShortfallPence`. The old code ignores all four: a booking
  still held by a shortfall would be paid by the old release job, and the
  who, when and why of an acceptance stay in the columns and the
  SHORTFALL_ACCEPTED audit rows, unread;
- a Stripe dashboard refund recorded as a STRIPE_DASHBOARD record but not
  yet applied (`finalizedAt` null) has had no cleaner-side consequence; the
  old code would pay the full unscaled earnings.

Before any rollback deploy, in this order, on James's word:

1. Stop the money jobs from acting: pause the cron caller (Railway cron
   service) so no tick runs during the switch.
2. List what the new code wrote (read only):
   `SELECT count(*) FROM "RefundSlice" WHERE "idempotencyKey" NOT LIKE 'legacy_%';`
   `SELECT count(*) FROM "TransferSlice" WHERE "kind" <> 'ADOPTED';`
   `SELECT id, status FROM "Dispute" WHERE status IN ('RESOLVING_REFUND','RESOLVING_RELEASE');`
   `SELECT id FROM "Booking" WHERE "transferStatus" IN ('UNKNOWN','REFUNDING');`
   `SELECT id FROM "Booking" WHERE "amountShortfallPence" > 0 AND "shortfallAcceptedAt" IS NULL AND "transferStatus" = 'PAUSED';`
   `SELECT id FROM "RefundRecord" WHERE "triggeredBy" = 'STRIPE_DASHBOARD' AND "finalizedAt" IS NULL;`
   If any count is non-zero, every such booking is reconciled by hand in the
   Stripe dashboard before the old code runs, and the decision is James's.
3. Return resolving disputes to a state the old code understands:
   `UPDATE "Dispute" SET status = 'OPEN' WHERE status IN ('RESOLVING_REFUND','RESOLVING_RELEASE');`
   (their money step may already have run: check each against Stripe first;
   the old resolve would otherwise refund again).
4. Deploy the previous commit. The tables and columns are additive and the
   enum values stay (Postgres cannot drop enum values); the old code ignores
   them. `stripeTransferId` and `allocation` were never cleared, so legacy
   rows read as before. The old seed recreates the two fee rows on its own.
5. Resume the cron caller.

Re-deploying B4 after a rollback is safe: the backfill is idempotent and
skips rows it already wrote.
