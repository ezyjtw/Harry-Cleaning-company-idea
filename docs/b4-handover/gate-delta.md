B4 GATE DELTA. For James and the independent auditor.

Branch claude/b4-money-ledger: reviewed head bec3110, delta b3ac3db, c5ef312, 3a4723c, 7cc6273, then 75d60e8 (proof: tests, bench, walk) and the register commit. Nothing merged, nothing deployed, no OTA, no shell touched, no production read or write. Stripe: sk_test only, through the stripe-test network secret (GET /v1/balance answered 200, livemode false, before anything else ran). No live Stripe call.

STATE: STOPPED AT THE GATE. Items 1 to 9 of the hold are complete.

Full diff for review (money code): `git diff bec3110..75d60e8 -- src` is the delta (18 source files plus the integration suite). This session changed no money source: 75d60e8 adds three tests to the integration suite, the bench, and a proxy line in the walk script.

1. PARTIAL DASHBOARD REFUNDS JOIN THE ONE LEDGER (b3ac3db)
   As in the draft: a STRIPE_DASHBOARD record scales the unreleased cleaner amount before release, reverses the cleaner share across the slices after release, waits (DEFERRED) while money is in flight, and is applied once. One share formula everywhere on the applied basis.
   Proof: D1 to D5 pass. New this session: D6, three appliers of one deferred record at once (the reconciler twice and a re-delivered event), at 30 reps. D4 never reached the apply CAS: its two deliveries race to create the record and the unique Stripe refund id stops the loser first. D6 tests the CAS itself.
   Bench on D6: the attempt CAS alone removed stays green because the booking's REFUNDING claim still serialises. Both removed: red (a losing applier throws on the unique reversal key, no money doubled). All four layers removed (both CAS, the reversal key, the in flight reversal precheck): red with the reversal doubled, 2500 where 1250 is right. The applied basis replaced by the old executed basis turns D5 red.
   Walk case 5 (Stripe test mode): a 1625 dashboard style refund after a split release; the real charge.refunded event read from Stripe and fed to the handler twice; one record; reversals 1350 read from Stripe's own reversal list, once.

2. TOPUP_WITHOUT_ASSIGNMENT COMPLETE RECOVERY (c5ef312)
   T1, T2, T3, T4, T4b, T5 pass.
   Bench: the recovery removed turns T1, T4 and T5 red. The inner "only once Stripe confirms" check alone stays green: the caller already returns on PENDING and UNKNOWN before it. With the recovery also called before that return, T5 goes red. Defended twice, proven as the pair.

3. CANCELLATION LADDER (3a4723c)
   14 cases pass under four process time zones. Bench: the Flexible anchor put back to 00:00 London turns 4 of the 14 red.

4. NO 1P TOLERANCE (3a4723c)
   Finding: no test could fail on this ruling. The bench put the tolerance back and nothing went red. Added P1: one penny over the remainder is refused with nothing sent to Stripe; the exact remainder executes and the booking reads REFUNDED. The tolerance restored in the refund service now turns P1 red.
   The same restore in the dispute split is an equivalent mutant: the split of whole check refuses anything at or above the remainder before that line runs. Nothing proposed; the line is dead but harmless.

5. ACCEPT SHORTFALL AND RELEASE (3a4723c)
   Case 8, N7, R2, case 11 pass. Bench: the hold lifted without an acceptance, red; the reason check removed, red.

6. THE SCHEDULER OBEYS THE NEVER GUESS GUARD (7cc6273), NOW PROVEN
   S1 green on a dedicated database (rena_b4_fresh).
   Bench: release guard and batch filter both removed, S1 red. Guard alone removed, S1 red (the direct release and the job both pay). Late payment clause reverted, S1 red. Filter alone removed, S1 green: the guard inside releaseBookingFunds still refuses, so no money moves. The filter exists so waiting bookings cannot crowd releasable ones out of the 50 booking batch, and nothing tested that. Added S2: 50 waiting bookings with older due dates and one releasable booking; the releasable one releases. The filter removed turns S2 red.

7. RERUNS (all on rena_b4_fresh, a fresh local database, never the shared rig)
   B4 money suite: 38 of 38 at 30 reps (35 from the handover plus P1, D6, S2).
   B3 matrix: 28 of 28. Unit: 358 pass. Typecheck clean (after next build writes next-env.d.ts, as on any fresh clone). Lint clean on every changed file.
   Migration rehearsal: two invocations, four runs of 600 production shaped bookings, all pass, identical output.
   Mutation bench: docs/b4-handover/bench/b4-mutations-delta.py, outputs b4-mutations-delta.out, b4-mutations-delta-followup.out, b4-mutations-d6.out. The drifted chargeback anchor refreshed: red on N7. Every delta guard red alone, or as the named set where defended twice by design.
   Hash law: a control of main 8999830 and the branch, built here and served from the same database: all 26 routes identical. Against the earlier committed control file, / and /cleaners differ; main served here differs from that file in exactly the same two routes, so it is the database content, not the branch. No public route moves. Files: b4-hash-control-delta.json, b4-hash-branch-delta.json.
   CI: the e2e job's database is a fresh postgres:16 container, migrated and reference seeded. The B3 matrix runs on it first and leaves no booking (rig: 0 bookings after the matrix, then S1 and S2 pass on the same database). S1 and S2 therefore run in CI.

8. STRIPE TEST MODE WALK: 5 OF 5 (docs/b4-handover/bench/b4-stripe-walk.out)
   Every amount read from Stripe's own objects, not the ledger.
   Case 1, payout across an original 4000 and a top up 2500: two transfers, 4000 and 1400, summing to 5400, each to the cleaner account, grouped by booking, anchored to one of the booking's charges.
   Case 2, partial refund before release: one 1500 refund on Stripe, succeeded; the unreleased share scaled to 4050; the release pays 4050.
   Case 3, post release refund of 2000: it landed on the top up (LIFO); reversals 1662 = round(5400 x 2000 / 6500), spread across both transfers; no slice unresolved.
   Case 4, dispute refund: RESOLVED, 6000 refunded on Stripe, booking REFUNDED, no payout.
   Case 5, as in item 1.
   The walk can fail: with LIFO allocation removed, case 3 goes red on Stripe's refund list (0 of 2000 on the top up). Source restored after.
   Two environment notes:
   a. The Stripe SDK builds its own https agent and ignores HTTPS_PROXY, so it reached Stripe directly with the placeholder key and got 401. The walk script now gives its Stripe client the proxy agent when HTTPS_PROXY is set. src is untouched.
   b. The walk could not create its own Custom connected account: Stripe asks the test platform to accept the Connect platform profile responsibilities, a dashboard setting that changes only on your word. The walk used the script's documented fallback, an existing onboarded Express test account, acct_1TtlaPBtudmKMwFO. Its test balance now carries the walk's test transfers (test money only).

9. REGISTER AND RUNBOOK
   Register: RENA-010, 011, 015, 016, 017, 089, 093 and the B4 batch line (the ladder ruling) updated with the commits, files, tests and bench; change log entry added. All stay BUILT, gate pending.
   Runbook rollback: the three shortfall acceptance columns (old code ignores them and would pay a booking still held by a shortfall) and unapplied dashboard refunds (old code would pay unscaled earnings), with two read only checks.
   docs/design/B4.md: "Clear shortfall" and "Retry assignment" marked superseded by rulings 5 and 2; the design text kept.

PARKED, NOT GUESSED

1. The cleaner facing breakdown line for add ons (no booking can carry one yet).
2. The Stripe return room's checking state walk (B3 park) joins the live money rehearsal.
3. The handover asked for "073 park removed". The only park on RENA-073 is item 1 above, which the draft keeps, so RENA-073 is unchanged. Your word on which park was meant.
4. RENA-093's lost chargeback default (gate report 4b) still reads "parked for ruling" in the register. This session does not hold the HELD message's text, so the ruling was not written in. Your word, or the text, and it goes in.
5. Whether the walk's Custom account path should be enabled (accepting the test platform's Connect responsibilities) for future walks, or the Express fallback stays the method.

DEPLOY SHAPE (unchanged): WEB only, two migrations on deploy, no shell change, no OTA, no hash re baseline.

UAT ADDENDUM for after a deploy, only on your word (adds to the gate report's list)

1. Stuck money, a shortfall booking: Accept shortfall and release asks for a reason; under five characters is refused; after acceptance the booking releases and the audit shows SHORTFALL_ACCEPTED with expected, captured and shortfall. Failure: release with no reason, or amounts changed.
2. A partial refund made in the Stripe dashboard on a released test booking: one STRIPE_DASHBOARD record, a transfer reversal equal to the cleaner share, booking PARTIALLY_REFUNDED. Watch the log line refund external_refund_applied. Failure: a DASHBOARD_REFUND_PENDING row that persists after a minute with no money in flight.
3. A Flexible clean cancelled 30 hours before 06:00 London on its date: 50 percent refund. Failure: 0 percent (the old UTC midnight count).
4. A booking with an unread legacy refund (LEGACY_RECONCILE row): Release now answers "still being reconciled" and no transfer appears in Stripe until the row clears.
