B4 GATE DELTA (DRAFT, items 1 to 6 written; 6 proof, 7, 8 and the register still to come)

Branch claude/b4-money-ledger, reviewed head bec3110, delta b3ac3db, c5ef312, 3a4723c, 7cc6273. Nothing merged, nothing deployed, no OTA, no production read or write, no live Stripe call.

1. PARTIAL DASHBOARD REFUNDS JOIN THE ONE LEDGER (b3ac3db)
   A refund made in the Stripe dashboard is recorded as a STRIPE_DASHBOARD record and applied exactly as a Rena refund would be. Before release it scales the unreleased cleaner amount by the cleaner share. After release it creates the proportional TransferReversal slices. It waits (DEFERRED) while a Rena refund or a payout is in flight, while a slice is unresolved, or while a released slice's amount is still unknown. The reconciler re-applies any deferred one after a minute. The claim and the context write share one transaction behind a compare and set on the record's attempt, so duplicate webhooks apply it once.
   One formula for the cleaner share everywhere, on the applied basis: charged money, less flagged top-ups, less what other records have already applied. This fixed an order dependence the bench found (D5 paid 22.50 instead of 25.00 when an unapplied dashboard refund sat beside a Rena refund).
   Tests: D1 25 percent before release; D2 25 percent after a split transfer release; D3 a dashboard refund of the whole original while a top-up remains; D4 a duplicate charge.refunded delivered twice at once (reps); D5 a dashboard refund racing an in-flight Rena refund. All pass.
   The earlier full refund stop (R7) now runs through the same path.

2. TOPUP_WITHOUT_ASSIGNMENT COMPLETE RECOVERY (c5ef312)
   Refund confirmed, then the provisional cleaner cleared, then the previous cleaner restored through the B3 locked helper. If that cleaner lost the slot: opted in to Rena choosing goes to the admin assignment queue (RENA_FIND_ADMIN_REVIEW); not opted in takes the standard no-cleaner exhaustion, which refunds the rest and cancels. A cascade-sourced provisional resumes the cascade (Phase 2), or exhausts by the cascade's own law when no backup is left. The recovery runs only once Stripe confirms the refund, and only once. Every outcome is audited (TOPUP_RECOVERY_COMPLETED). No path leaves a provisional cleaner on a booking with refunded money.
   Tests from the B3 fixture: T1 restored; T2 admin queue; T3 exhaustion; T4 cascade resumed; T4b cascade exhausted; T5 an unknown refund outcome reconciled later recovers exactly once.

3. CANCELLATION LADDER (3a4723c, as ruled)
   Fixed time: the 48 and 24 hour thresholds count from bookingStartUtc, the London wall clock start. Flexible: anchored at 06:00 Europe/London on the booking date. Tests to the minute on GMT, BST and both 2026 change days, run under four process time zones (UTC, Europe/London, America/Los_Angeles, Asia/Tokyo): 14 pass. One case shows the old fault: a clean 30 hours ahead now gets 50 percent where UTC midnight gave 0.

4. NO 1P TOLERANCE (3a4723c)
   requestedRefundPence <= remainingRefundablePence exactly, in the refund service, the dispute split and the admin booking pages. No reproducible integer pence case exists: toPence round trips every value from 0 to 10,000,000 pence exactly, including 19.99 and 0.29.

5. ACCEPT SHORTFALL AND RELEASE (3a4723c)
   The shortfall hold lifts only on an explicit admin decision with a reason (at least five characters), recorded as who, when and why on the booking (three new nullable columns in the B4 migration) and audited as SHORTFALL_ACCEPTED with the expected, captured and shortfall amounts. The amounts stay as they were: nothing is rewritten. An admin who intends to collect does nothing, and the hold stays. A second acceptance is refused. Release resumes only if no other hold remains (a lost chargeback still holds, R2).
   Tests: case 8 (refused with no reason or a short one; held until accepted; amounts, who, when, why and the audit all checked), N7 coexistence, R2, case 11 (the queue action takes the reason). Migration re-proven: the rig and a fresh database both show no difference from the schema.

6. THE SCHEDULER OBEYS THE NEVER GUESS GUARD (7cc6273, PROOF PENDING)
   Finding: the payout path had no guard. A booking with an unread legacy refund (the migration's NEEDS_RECONCILE) and a PENDING payout would have been paid in full by the release job, before anyone knew how much the customer had already been refunded. Refunds were already guarded: every refund call site goes through refundBooking.
   Fix: releaseBookingFunds refuses with LEDGER_RECONCILIATION_PENDING while any refund slice on the booking is PENDING, UNKNOWN or NEEDS_RECONCILE, or a dashboard refund is not yet applied. Every payout path uses it: the release job, Release now, resumes and the dispute release leg. The release job leaves such bookings out of its batch so they cannot crowd out others. The late payment refund path also skips a legacy FAILED record whose slice is unread, so it never writes SUCCEEDED onto a booking it then cannot refund.
   Test S1: with a NEEDS_RECONCILE slice, the release job, a direct release, an unapplied dashboard refund, cascade exhaustion, the dispute retry job on both legs and the late payment path move no money; once Stripe has been read, the job releases it.
   TO ADD: S1 green on a dedicated database, and the bench (each guard removed turns S1 red).
   Rig note: S1's first run, against the shared rig, let the cascade sweep refund four drive bookings through the fake Stripe. Restored on James's word in one transaction. S1 now refuses to run where any booking is not its own.

7. RERUNS: TO COME (full B4 suite at 30 reps, B3 matrix, unit, typecheck, lint, rehearsal twice, mutation bench with the new guards, hash sweep).

8. STRIPE TEST MODE WALK: TO COME (five cases; scripts/b4-stripe-test-walk.ts).

PARKED, NOT GUESSED

1. The cleaner facing breakdown line for add-ons (no booking can carry one yet).
2. The Stripe return room's checking state walk (B3 park) joins the live money rehearsal.
   (The old park "a partial dashboard refund changes nothing on the cleaner side" is closed by item 1; the old park "retry assignment for TOPUP_WITHOUT_ASSIGNMENT" is closed by item 2.)
