# B4 gate delta: handover to the next session

**Status (session 018mwW2D, 2026-10-07): items 1 to 9 complete; STOPPED AT THE GATE.** The
final delta report is gate-delta.md (the draft is superseded). Proof commit 75d60e8; the
sections below are the earlier handover, kept as written.

Branch claude/b4-money-ledger. The reviewed head was bec3110. The delta so far is
b3ac3db, c5ef312, 3a4723c and 7cc6273, plus this handover commit. Nothing is
merged, deployed or published. The gate stays HELD until James's word.

James's rulings for the delta are the "B4 GATE: HELD" message (items 1 to 9).
The webhook events charge.dispute.created and charge.dispute.closed are already
on the platform destination (James confirmed). The branch push is allowed;
never rewrite its history.

## 1. Where each item stands

1. Partial dashboard refunds join the ledger: DONE (b3ac3db). Tests D1 to D5.
2. TOPUP_WITHOUT_ASSIGNMENT complete recovery: DONE (c5ef312). Tests T1, T2,
   T3, T4, T4b, T5.
3. Cancellation ladder (fixed start from bookingStartUtc, Flexible anchored at
   06:00 Europe/London): DONE (3a4723c). src/lib/services/cancellation-ladder.test.ts.
4. No 1p refund ceiling tolerance: DONE (3a4723c). No reproducible integer pence
   case exists; toPence round trips every value 0 to 10,000,000 pence
   (src/lib/money/ledger.test.ts).
5. Accept shortfall and release: DONE (3a4723c). Three new Booking columns in
   the 20261008091000_money_ledger migration (shortfallAcceptedAt,
   shortfallAcceptedById, shortfallAcceptReason). Case 8, N7 and R2 updated.
6. Scheduler obeys the never guess guard: BUILT (7cc6273), NOT YET PROVEN.
   releaseBookingFunds refuses with LEDGER_RECONCILIATION_PENDING while any
   refund slice on the booking is PENDING, UNKNOWN or NEEDS_RECONCILE, or a
   STRIPE_DASHBOARD record is not yet applied (finalizedAt null). The release
   job leaves such bookings out of its batch. The late payment path also skips a
   legacy FAILED record whose slice is unread. Refunds were already guarded
   (every refund call site goes through refundBooking). Test S1 covers the
   release job, the direct release, an unapplied dashboard refund, cascade
   exhaustion, the dispute retry job (both legs) and the late payment path, then
   proves the booking releases once Stripe has been read. NEXT: run S1 and the
   full suite on a dedicated database (section 3).
7. Reruns: NOT STARTED (section 3).
8. Stripe test mode walk: SCRIPT READY, NOT RUN (section 4).
9. Gate delta report: DRAFT in gate-delta-draft.md; finish after 6 to 8.

Still owed with the report: register entries (011, 015, 017, 073 park removed,
093, the ladder entry, and any entry the item 6 guard touches) and
docs/b4-money-ledger-runbook.md (the shortfall paragraph now says "Accept
shortfall and release"; the rollback list should add the three shortfall
columns, which old code ignores). docs/design/B4.md still says "Clear
shortfall" at lines 66 and 78: mark it superseded by gate ruling 5 rather than
rewriting the design.

## 2. The rig incident (fixed) and the rule it left

S1's first run was against the shared rig database. Its cascade exhaustion
sweep reads the whole database, so it refunded four drive bookings through the
fake Stripe (no real money, no production): cust-appr1, drv-day1-offer,
drv-fin-paid, drv-o1. On James's word they were restored in one transaction:
the four test created refund records with their slices, four audit rows and
eight bells deleted; the bookings reset to CASCADE_EXHAUSTED, payment
SUCCEEDED, payout FAILED (cust-appr1) or PENDING (the rest), earnings and fee
54.00 and 3.54 (36.00 and 2.16 for drv-fin-paid), cancellation fields empty.

Those four bookings also carry many older refund records from earlier sessions
(15 September to 6 October); they were left exactly as found.

The rule: S1 now refuses to run where any booking is not its own fixture. Run
the money integration suite against a dedicated database, never the shared rig:

    psql postgresql://rena:rena@127.0.0.1:5432/postgres -c 'DROP DATABASE IF EXISTS rena_b4_fresh' -c 'CREATE DATABASE rena_b4_fresh OWNER rena'
    DATABASE_URL=postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh npx prisma migrate deploy

Cases 7a, 7c and R3 call retryResolvingDisputes, also a whole database sweep;
the dedicated database covers them too. Confirm the CI job's database starts
empty before relying on CI for S1 (not yet checked).

If Postgres is down after a container restart: `pg_ctlcluster 16 main start`.

## 3. Item 6 proof and item 7 reruns (exact commands)

All against rena_b4_fresh unless stated.

1. Item 6: `MONEY_LEDGER_INTEGRATION=1 DATABASE_URL=postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh MONEY_LEDGER_REPS=2 npx vitest run src/lib/money/money-ledger.integration.test.ts -t S1`
2. Item 6 bench (the guard must be able to fail): remove the
   `if (await refundMoneyUnsettled(prisma, bookingId))` block in
   src/lib/services/transfer.service.ts AND the `refundRecords: { none: ... }`
   filter in processDueReleases; S1 must go red. Then each alone, and record
   which assertion catches it. Also revert the late payment OR clause in
   payment-success.service.ts and confirm S1's late payment assertion goes red.
3. Full B4 suite at 30 reps: same command without `-t`, MONEY_LEDGER_REPS=30.
4. B3 matrix: `BOOKING_LIFECYCLE_INTEGRATION=1 DATABASE_URL=... npx vitest run src/lib/booking/assign.integration.test.ts` (check that file's own database expectations first).
5. Unit, typecheck, lint: `npx vitest run`, `npx tsc --noEmit -p .`, `npx eslint` on the changed files.
6. Rehearsal twice (the migration changed): `bash scripts/b4-migration-rehearsal.sh` (see bench/b4-rehearsal.out for the expected shape).
7. Mutation bench: bench/b4-mutations.py, b4-mutations-r.py, b4-mutations-r2.py
   (DATABASE_URL defaults to rena_b4_fresh). Anchors drifted since the first
   run; the chargeback one already reported ANCHOR MISSING
   (bench/b4-mutations-rerun.out). Refresh anchors, then add the new guards:
   the dashboard apply CAS, the applied basis, the top-up recovery, the
   Flexible anchor reverted to 00:00, the 1p tolerance restored, the shortfall
   accept hold, and the item 6 guard.
8. Hash sweep against the control: build the branch with bench/build-with-env.sh,
   a control worktree of main 8999830 with bench/build-control.sh
   (WT=<worktree>), serve each with bench/serve2.sh (S=<folder with the start
   scripts>), then `npx tsx scripts/public-route-hashes.ts --compare docs/b4-handover/bench/b4-hash-control.json`.
   All 26 routes must be identical; no public route should move in this delta.

The bench scripts carry only dummy rig values (sk_test_dummy and the like) and
synthetic @integration.invalid fixtures.

## 4. The Stripe test mode walk (item 8)

This session could not authenticate to Stripe: an unauthenticated
/v1/balance answered 401 and the proxy injected no Stripe credential. The
stripe-test network secret is picked up by a new session.

Script: scripts/b4-stripe-test-walk.ts. Five cases: a payout across an original
and a top-up; a partial refund before release; a post-release refund with
reversals; a dispute refund; a partial dashboard refund after a split release,
fed through the real charge.refunded event twice.

    DATABASE_URL=postgresql://rena:rena@127.0.0.1:5432/rena_b4_walk \
    STRIPE_SECRET_KEY=sk_test_proxy_injected \
    npx tsx scripts/b4-stripe-test-walk.ts

Use its own fresh database (create and migrate rena_b4_walk as in section 2).
STRIPE_SECRET_KEY is a placeholder; the proxy supplies auth. The other service
env vars can come from bench/build-with-env.sh (dummy values).

Refusals proven in this session (exit 2, nothing written): a non local
DATABASE_URL; a live looking key; Stripe not authenticating (401, which is what
this session gets). The script also refuses unless balance.retrieve answers
livemode false.

Connected account: the script creates a Custom GB account with Stripe's test
verification values and waits up to 60 seconds for the transfers capability.
If Stripe still wants something, it prints what is due and stops; then pass
B4*WALK_CONNECT_ACCOUNT=acct*... (an onboarded test account).

Every amount is checked against Stripe's own objects, not the ledger: transfers
sum to the earnings and are anchored to the booking's charges; the partial
refund is one 1500 refund and the unreleased share is scaled to 4050; the post
release 2000 refund lands on the top-up (LIFO) and reversals total
round(5400 x 2000 / 6500) = 1662 across both slices; the dispute refunds 6000
before RESOLVED and pays the cleaner nothing; the dashboard refund of 1625
reverses round(5400 x 1625 / 6500) = 1350 once, with one STRIPE_DASHBOARD
record despite the duplicate.

## 5. Files in this folder

1. b4-gate-report-as-submitted.md: the original B4 gate report.
2. gate-delta-draft.md: the delta report draft (items 1 to 6 written).
3. bench/: mutation scripts and their outputs, the rehearsal output, the build
   and serve scripts, the hash control and branch files, the admin drive.

The full money diff for James's review is regenerated, not committed:
`git diff 8999830..HEAD > b4-full.diff` (whole batch) and
`git diff bec3110..HEAD` (the delta).
