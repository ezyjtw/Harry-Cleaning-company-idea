B4 GATE REPORT: Money ledger. For James and the independent auditor.

Branch claude/b4-money-ledger, head bec3110, seven commits on main 8999830. Nothing merged, nothing deployed, no OTA, no production read or write, no live Stripe call. The branch is committed locally only: the push to the remote was refused by the session's permission layer and was not retried (your call).
Full money diff for review: b4-full.diff (52 files, 7197 additions, 1767 deletions).

STATE: STOPPED AT THE GATE.

1. WHAT WAS BUILT, PER RULING

Ledger tables (migrations 20261008090000 dispute enum values, 20261008091000 money ledger)
TransferSlice, TransferReversal, RefundSlice, ChargebackHold. Stripe transfer, refund and reversal ids unique in the database. Every new column nullable or defaulted: the control build of main served all 26 public routes against the migrated rig.

Never-guess migration (ruling)
Legacy transfers become ADOPTED slices, NEEDS_RECONCILE, amount null. Legacy refunds become slices claiming no executed money: NEEDS_RECONCILE with a stored Stripe refund id, UNKNOWN without one, FAILED only for a definitive legacy failure with no id. A record whose refund id another slice already holds still gets a slice (NEEDS_RECONCILE, no id). No booking payment or transfer state is rewritten. Money actions on an affected booking answer LEDGER_RECONCILIATION_PENDING until Stripe has been read.

Refunds (RENA-011, 088, 089, 090, 091)
One slice per charge, newest top-up first then the original, each written PENDING with its own key before Stripe is called; one same-key retry, then UNKNOWN, reconciled by reading Stripe, never re-sent. Booking REFUNDED or PARTIALLY_REFUNDED written by one function, only when no slice is unresolved. Earnings, Xero per slice and messages run exactly once per executed penny. Cascade exhaustion, stuck jobs, cancellation and disputes all use the ledger remainder.

Transfers and reversals (RENA-010, 087)
Each charge (original and each succeeded top-up, whose charge id is now stored) gets its own anchored slice up to its own amount; the rest is one excess slice; the transfer group is read before anything is created. A post-release refund reverses each slice in proportion under its own key.

Disputes (RENA-013, 092)
RESOLVING_REFUND and RESOLVING_RELEASE; RESOLVED only after the money is confirmed; a lost race answers 409 with nothing written; retries with backoff; RESOLVING_REFUND also holds release; the money step is single flight.

Holds (RENA-017, 093, ruling N7)
Dispute, shortfall and chargeback holds coexist; release resumes only when none remains; an open or lost chargeback holds; a chargeback after release is CHARGEBACK_AFTER_RELEASE in stuck-money.

Retry and backoff (ruling)
2m, 2m, 5m, 15m, 60m, then 4h; persistent after six reads. Three scheduler jobs under the existing lease: transfer slice reconcile, refund and reversal reconcile, dispute money retries.

N9 (RENA-095)
Stored deterministic key, one same-key retry, then UNKNOWN: no pay-now email, both recurring sweeps skip it, the stranded payment sweep reconciles it read only. Never a new-key charge while unknown.

N8 (RENA-094)
PlatformConfig defaults are create-if-missing.

Add-ons (RENA-073, D-a)
The parent service's share unless the add-on sets its own; products keeps 90 percent.

Fee controls (RENA-075)
The two keys removed; rates in src/lib/pricing/rates.ts shown read only; the config POST takes seven allowlisted keys with numeric values only.

Stuck money (RENA-015, 080)
24 states, each row with age, amount, detail, a persistent marker and its actions; retry-refund deleted; the reconciliation route reads executed slices.

REASSIGN_REVERT_CONFLICT (B3 park)
Stamped on the first refused revert, cleared when one lands, shown with Retry revert.

UTC-midnight refund ladder (B3 park). RULE CHANGE, NEEDS YOUR RULING
The 48 and 24 hour ladder and the short-notice grace now count from the clean's London start time (a Flexible clean from the start of its London day), matching the published words "full refund up to 48 hours before your clean". They counted from the stored UTC midnight, which cut every threshold early by the start hour. Some cancellations now receive more refund than the old code gave.

2. INDEPENDENT REVIEW (Fable 5.1) AND WHAT WAS DONE

1 BLOCKER, Retry remainder not exclusive (two clicks, or the dispute retry job beside an admin retry, could refund the remainder twice). FIXED: single flight per record (CAS to RETRYING, reclaimable after 10 minutes), the booking's REFUNDING claim taken only when this record's own reversal holds it, refused while any slice on the booking is unresolved. Test R1 at 15 and 30 reps: one runs, the remainder is refunded once.
2 MAJOR, a lost chargeback did not hold (a later shortfall clear or dispute release could pay the cleaner). FIXED: LOST is a hold reason; only the admin's recorded settlement lifts it. Test R2.
3 MAJOR, the dispute money step not single flight and could adopt a lock-failed record. FIXED: a lease on the dispute (new column moneyStepLockedAt), a SKIPPED result never adopted, the record id written only when empty. Test R3: the lease and the record lock are independent guards; either alone holds; both removed turns red.
4 MAJOR, PAUSED with no hold invisible with no exit. FIXED: TRANSFER_PAUSED_NO_HOLD with Resume release (refused if a hold appears). Test R5.
5 MINOR, a split of the whole remainder stuck. FIXED: refused, use refund-customer. Test R4.
6 MINOR, a parked legacy slice had no admin exit. FIXED: Match refund id (Stripe read confirms it belongs to the slice's payment) and Mark not executed (refused when a refund id is stored), both audited. Test R6.
7 MINOR, a full dashboard refund before release still paid the cleaner. FIXED: the payout is stopped (REFUNDED) and audited. Test R7. A partial dashboard refund still changes nothing on the cleaner side (parked).
8 MINOR, items to name: all named in section 4.
9 MINOR, a retried top-up refund could land on the original charge. FIXED: the record keeps its payment intent.
10 MINOR, a duplicate confirmation email when the webhook won the race. FIXED: the reconciler sends it only when the request is over 10 minutes old.
The reviewer found sound: the pure ledger, release and reconciliation, reversals, the finalisation guard, charge.refunded, the dispute transition, N9, the shortfall write, the migration and rollback wording, the seed, the add-on arithmetic, hash law, log hygiene, and the honesty of the tests.

3. EVIDENCE
   Unit: 342 pass. Typecheck and lint clean.
   Integration on rig Postgres with the scripted Stripe fake, now in CI: 23 cases, all pass at 30 repetitions. They cover duplicate webhooks, cancel against payment, LIFO and dashboard refunds, partial execution, split payouts and reversals, four unknown-outcome shapes, three dispute races, shortfall, add-ons, chargebacks, N9, the queue, and the seven review findings. The B3 concurrency matrix still passes 28 of 28.
   Mutation bench (each guard removed, its test must go red): 15 of 15 single guards red in the suite, plus the rehearsal's own. Two places are defended twice by design and each pair is proven: the transfer double-pay guard (group read and kept key) and the dispute money step (lease and record lock): either alone stays green, both removed turn red.
   What the bench caught in my own build before the review: a double finalisation race (two finalisers could both apply a refund's consequences) and a shortfall booking's refund ceiling; both fixed.
   Migration rehearsal (scripts/b4-migration-rehearsal.sh), rerun after the review fixes: twice, 600 production-shaped bookings each, pre-B4 schema from main, then migrate deploy: schema equals the datamodel; 360 of 360 legacy transfer ids became slices; every legacy refund record has a slice; none claims executed money; none is SUCCEEDED; payment state untouched; fee rows gone; the backfill re-run twice changes nothing; a second deploy is a no-op. The rehearsal goes red when one ON CONFLICT is removed.
   N8 bench: an admin edit survives the branch seed; main's seed resets it.
   Hash law: all 26 public routes identical to a control build of main 8999830, checked on the first build and again on the rebuilt head bec3110 after the review fixes.
   Admin drive on the built branch: the stuck-money rows with age and actions, Set release clock works, Clear shortfall asks for a second tap, the pricing page shows read-only rates with Edit only on allowlisted keys, a scheduler marker POST answers 400, the booking money panel reads the ledger.

4. NAMED FOR YOUR RULING
   a. The refund ladder from the London start (rule change, above).
   b. A lost chargeback keeps holding until an admin records "Release to cleaner anyway" (the default the code now enforces).
   c. Clearing a shortfall corrects the captured total to what Stripe received; cleaner earnings untouched.
   d. A full dashboard refund before release stops the payout.
   e. The one penny tolerance on refund ceilings (carried over from the old code).
   f. Departures from the design: the cleaner share on the remaining basis (equal to the design's formula with no earlier refunds, correct after them); RefundRecord context and finalisation columns, statuses PARTIAL and RETRYING; Dispute refundRecordId and moneyStepLockedAt; a third scheduler job; the 24h FAILED rule waits when the payment carries an unmatched refund; a record stopped at an unknown reversal waits for Retry remainder once the reversal settles; the admin booking page reads the ledger (it double counted top-ups); the admin dispute page's OPEN to UNDER_REVIEW write is guarded.

5. RULE 20 FINDINGS
   a. The services page "85 percent of add-on revenue" (services/[category]/page.tsx:147) is a source comment, never rendered: the sanctioned copy change has no rendered target; the comment is corrected; no hash moves. Proposed register change: strike RENA-073's hash clause.
   b. No charged quote carries a database add-on today (the wizard sends only "products"). The split is built and tested; it reaches money only when add-ons ship.

6. PARKED, NOT GUESSED
7. Retry assignment for TOPUP_WITHOUT_ASSIGNMENT (needs its own design; the row offers Refund top-up).
8. The cleaner-facing breakdown line for add-ons (no booking can carry one yet).
9. A partial dashboard refund after or before release reverses or scales nothing on the cleaner side (recorded and visible; an admin decision).
10. The Stripe return room's checking-state walk (B3 park) joins the live-money rehearsal.

11. STRIPE TEST-MODE WALK: WHAT I NEED AND WHEN
    When: after you have read this gate and before your merge word. About 30 minutes on the rig; the result returns as a gate delta.
    What:
    a. A Stripe TEST-mode secret key (sk_test) for a test account with Connect enabled, added as an environment secret in this session's environment settings, never pasted into chat or Git. No publishable key needed.
    b. api.stripe.com in the allowed domains: it already answers from this session (401 without a key), so this is a confirmation only.
    The walk: one payout across an original and a top-up charge, one partial refund before release, one post-release refund with reversals, one dispute refund.

12. CONFIG AT DEPLOY (James-side, on your word)
    The platform webhook destination must also send charge.dispute.created and charge.dispute.closed, or the chargeback hold never opens.

13. ROLLBACK
    docs/b4-money-ledger-runbook.md. Old-code rollback after the first new-format money mutation is not automatically safe (your wording): the runbook lists what the old code would misread, the read-only checks, and the dispute reset to run first.

14. DEPLOY SHAPE
    WEB only; two migrations apply on deploy; no shell change, no OTA, no hash re-baseline.

UAT LIST (for after a deploy, only on your word)
What changed: refunds, payouts, disputes, holds, stuck money, admin pricing, the cancellation ladder, the reference seed.

1. Deploy log: both B4 migrations applied, reference seed "Done", boot clean. Then stuck-money: expect LEGACY_RECONCILE and SLICE_NEEDS_RECONCILE rows that drain over the first few scheduler ticks; any row marked persistent after an hour is a failure to report. Log lines to watch: scheduler money_job_failed, refund slice_reconcile_threw, transfer release_unknown.
2. Admin pricing: a Rates panel; no cleaner_fee_pct or customer_fee_pct rows; Edit only on the seven allowlisted keys.
3. A customer cancellation more than 48 hours before a clean's start: 100 percent; between 24 and 48: 50 percent, measured from the start time, not midnight. Failure: a 409 "still being confirmed" on a booking with no earlier refund.
4. An admin partial refund on a completed, unreleased booking: the booking shows PARTIALLY_REFUNDED, the refund record shows requested and executed equal, Stripe shows one refund per charge touched.
5. A dispute resolve (split) on a test booking: the dispute reads RESOLVED, the booking COMPLETED, the cleaner paid the reduced share. Failure: the dispute stuck in RESOLVING with a lastMoneyError; it appears in stuck-money with Retry money step.
6. Nothing on the public site changes (hashes identical); a logged-out browser sees the same pages.
