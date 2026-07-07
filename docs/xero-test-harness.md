# Master Test Script — Part 13: Xero

> Slot this into the master test script as **Part 13**. It has two independent
> runs: **13.1** folds into the main gauntlet (prod-like, proves nothing pushes in
> test mode); **13.2** is a **separate sub-run** against Xero's **Demo Company**
> that actually exercises the fee/payout logic with real Xero API calls but no
> real money and no real books.

## 13.0 Why a harness is needed
The push layer hard-blocks Xero pushes unless Stripe is **live** — which is
correct for safety but means normal **test-mode** bookings never exercise the new
fee / payout / bank-transfer code. To prove it before launch we use a **dev-only
override** (`XERO_ALLOW_TEST_PUSH=true`) that lets test-mode events push **into a
Xero Demo Company**, never James's real books.

Guard semantics (`xeroPushAllowedInMode()` in `src/lib/services/xero-push.service.ts`):

| Stripe key | `XERO_ALLOW_TEST_PUSH` | Result |
|---|---|---|
| test (`sk_test_`) | unset / not `true` | **no push** (normal safety) |
| test | `true` | **push** (the harness) |
| **live** (`sk_live_`) | `true` | **HARD REFUSED** + loud error log |
| live | unset | **push** (normal production) |

`XERO_ALLOW_TEST_PUSH` is `required:false`, documented NEVER-in-production, and the
live+override combination refuses **all** pushes — belt and braces both directions.

---

## 13.1 Phase-1 guard checks — MAIN GAUNTLET (prod-like, no override)
Run in the normal gauntlet environment (**no** `XERO_ALLOW_TEST_PUSH` set).

- **G1 — no pushes in test mode.** With Stripe test keys and the override unset,
  complete a paid test booking + a payout. Then:
  ```sql
  SELECT count(*) FROM "XeroPushLog";   -- expect 0 (nothing enqueued or posted)
  ```
  Confirm no `XERO_PUSH` rows in `BackgroundJob` either.
- **G2 — no Rena Marketplace entries in live Xero.** In the **live** Xero org,
  Accounting → search contacts/bank transactions for **"Rena Marketplace"** →
  expect **none** (unless/until real live money has flowed post-launch).
- **G3 — override refused on a live key.** In any environment with a live Stripe
  key, if `XERO_ALLOW_TEST_PUSH=true` is ever set, the logs show
  `[xero-push] REFUSED: XERO_ALLOW_TEST_PUSH must NEVER be set with a live Stripe
  key` and **zero** pushes fire. (Verify by inspection of the guard; do not set a
  live key with the override in a real deploy.)

**Pass = G1 zero rows, G2 no entries, G3 refuses.**

---

## 13.2 Demo-Company UAT — SEPARATE SUB-RUN (dev/non-prod)
Actually exercises the logic against real Xero API calls, sandboxed.

### Setup
1. Deploy (or run locally) with **Stripe test keys**.
2. Set **`XERO_ALLOW_TEST_PUSH=true`** in that environment only.
3. Admin → Xero → **Connect Xero** → on the consent screen **choose the
   "Demo Company (UK)"** organisation (Xero provides one free per login), **not**
   the real org. The status card should read `Connected: Demo Company (UK)`.
4. Map every required account from the Demo Company's chart of accounts:
   Commission income, Platform fee income, Cleaner clearing, **Stripe fees**
   (expense), **Stripe balance account** (a bank account), **Settlement bank
   account** (a second bank account). Save → toggle **Push on**. Banner clears.
5. For payout events in dev, run the Stripe CLI:
   `stripe listen --forward-to <deploy>/api/webhooks/stripe` and set the printed
   signing secret as `STRIPE_WEBHOOK_SECRET` (or `_PLATFORM`) in the dev env.

### Scenarios
- **T1 — payment (fee line).** Create + pay a test booking (card `4242…`). In the
  Demo Company, open the **Stripe balance account** → a **Receive Money** with
  lines: commission, platform fee, cleaner clearing, **and a negative "Stripe
  processing fee"**. **Total = gross − Stripe fee** = what Stripe credited. ✅
- **T2 — payout (cleaner transfer).** Complete the job so the transfer releases
  (or trigger the release path). → a **Spend Money** for the cleaner net from the
  clearing line. `XeroPushLog` has a `PAYOUT` row, `status=COMPLETED`. ✅
- **T3 — refund (no fee reversal).** Refund the booking. → a reversing **Spend
  Money** (+ a clawback Receive if post-release) with commission / fee / cleaner
  lines and **NO Stripe-fee line** (Stripe keeps its fee). ✅
- **T4 — Stripe→bank payout.** `stripe trigger payout.paid` (test-mode platform
  payout). → a **Bank Transfer** in the Demo Company from **Stripe balance →
  Settlement bank** for the payout amount. `XeroPushLog` has a `STRIPE_PAYOUT` row
  (bookingId = the `po_…` id) with **`detail`** holding the balance-transaction
  bundle JSON. ✅ *(In test mode the bundle may be small/empty; the transfer still
  books.)*
- **T5 — idempotency.** From the Stripe dashboard/CLI, **re-deliver** the T1 and
  T4 webhooks. → **no duplicate** Xero entries (the `COMPLETED` `XeroPushLog` row
  short-circuits, and Xero's Idempotency-Key backstops a race). ✅
- **T6 — test-mode stamp.** Every row created in this run has
  `stripeLivemode = false` (they're test pushes) — the permanent audit marker.
  ```sql
  SELECT event, status, "stripeLivemode" FROM "XeroPushLog" ORDER BY "createdAt";
  ```

### Teardown (CRITICAL — do not skip)
1. **Unset `XERO_ALLOW_TEST_PUSH`** in the environment.
2. Admin → Xero → **Disconnect** (removes the Demo Company connection + tokens).
3. **Reconnect the real org:** if this was done in prod admin, click **Connect
   Xero** again and select James's **real organisation**, then **re-map** the
   accounts against the real chart and toggle push on. The connect flow supports
   re-connecting (it upserts a singleton `XeroConnection`), so reconnecting simply
   replaces the Demo Company connection with the real one.
4. Verify the status card reads the real org and the mapping is complete (banner
   gone) before real traffic.

> ⚠️ If you ran 13.2 in **production admin**, the Demo Company connection is live
> until you reconnect the real org. Do the teardown immediately after the sub-run.

---

## 13.3 What Claude Code verified by inspection vs needs James's eyes

**Verified by inspection (code/types/logic):**
- The mode guard truth table (live-only by default; test allowed only with the
  override; live+override hard-refused) — `xeroPushAllowedInMode()`.
- The fee line is negative, coded to `stripeFeeAccountCode`, appended after the
  `nonZero` filter → receive total = gross − fee (arithmetic).
- `payout.paid` is platform-only (`!event.account`) and books a bank transfer
  Stripe-balance → settlement with the bundle recorded to `XeroPushLog.detail`.
- Idempotency: `XeroPushLog` unique `(bookingId,event,externalRef)` +
  `COMPLETED` short-circuit + per-call Idempotency-Key.
- Required-mapping gate + the push-paused banner condition.
- `stripeLivemode` now records the real mode (false for harness pushes).
- Typecheck + lint clean.

**Needs James's eyes in the Demo Company (real Xero rendering — I cannot reach
Xero or a live Stripe/DB from the build sandbox):**
- T1–T6 actually appearing in the Demo Company with the right amounts/accounts.
- That the negative fee line renders and the Receive **nets** correctly in Xero's
  own UI (Xero's acceptance of a negative line item).
- That `createBankTransfer` posts a Bank Transfer Xero accepts between the two
  mapped bank accounts.
- The OAuth consent org-picker actually offering "Demo Company (UK)".
- G2 (no Rena Marketplace entries in the **live** org) — a look in his live Xero.
