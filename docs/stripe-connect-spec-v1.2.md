# Stripe Connect Specification — Rena Cleaning Network

**Status:** Draft v1.2
**Last updated:** June 2026
**Owner:** Harrison Wright (founder)

This document is the single source of truth for Rena's payment architecture. It captures every business and technical decision made about how money flows through the platform. Every Stripe-related pull request should reference this spec.

This spec covers the _what_ and _why_. Implementation details belong in the individual PR descriptions that reference it.

---

## 1. Overview

Rena is a two-sided marketplace where customers book independent cleaners. The platform handles payment intake, holds funds in escrow, and disburses to cleaners after agreed conditions are met. Rena takes a commission from each booking and adds a platform service fee on top.

This spec replaces Ryft as the payment provider. After implementation, Rena's payment stack is:

- **Payment processor:** Stripe (UK)
- **Marketplace product:** Stripe Connect
- **Connected account type:** Express
- **Charge type:** Destination charges
- **Fund management:** Escrow held in Rena's platform balance, released to cleaner per the rules in §5

---

## 2. Pricing model

### 2.1 Cleaner-set rates

Each cleaner sets their own prices on their profile. Two pricing structures coexist depending on service type.

**Hourly services** — cleaner sets one rate per service:

- Regular cleaning
- Deep cleaning
- Same-day cleaning

**Fixed-price services** — cleaner sets one price per property size:

- End of Tenancy: Studio, 1 bed, 2 bed, 3 bed, 4 bed, 5 bed+
- Airbnb / Short-let: Studio, 1 bed, 2 bed, 3 bed, 4 bed+

Cleaners can update their rates at any time via their dashboard. Rate changes apply to new bookings only — existing bookings are locked at the rate when they were created.

### 2.2 Commission structure

Rena takes commission from the cleaner's listed price. The commission rate depends on the service type.

| Service            | Commission rate | Cleaner receives |
| ------------------ | --------------- | ---------------- |
| Regular cleaning   | 10%             | 90%              |
| Deep cleaning      | 10%             | 90%              |
| Same-day cleaning  | 10%             | 90%              |
| End of Tenancy     | 15%             | 85%              |
| Airbnb / Short-let | 15%             | 85%              |

### 2.3 Platform fee

In addition to the commission deducted from the cleaner, Rena charges the customer a **6% platform fee** on top of the cleaner's listed price. This applies to every booking regardless of service type.

The platform fee is shown as a separate line item at checkout.

### 2.4 Worked examples

**Example A — 3 hours of Regular cleaning at £20/hr**

```
Cleaner's listed rate:       £20/hr × 3hrs = £60.00
Customer's platform fee (6%):                £3.60
─────────────────────────────────────────────────
Customer pays:                              £63.60

Cleaner's commission (10%):                  £6.00
Cleaner receives:           £60.00 − £6.00 = £54.00

Rena receives:
  Commission:                                £6.00
  Platform fee:                              £3.60
  ───────────────────────────────────────────────
  Total Rena:                                £9.60
```

**Example B — End of Tenancy clean at £300 for a 2-bed**

```
Cleaner's listed price:                   £300.00
Customer's platform fee (6%):              £18.00
─────────────────────────────────────────────────
Customer pays:                            £318.00

Cleaner's commission (15%):                £45.00
Cleaner receives:        £300.00 − £45.00 = £255.00

Rena receives:
  Commission:                              £45.00
  Platform fee:                            £18.00
  ───────────────────────────────────────────────
  Total Rena:                              £63.00
```

---

## 3. Money flow

### 3.1 At booking

When a customer completes checkout, the entire amount (cleaner price + 6% platform fee) is captured to **Rena's Stripe platform balance**. No funds are transferred to the cleaner at this stage.

The booking record stores the breakdown:

- `cleanerPayoutAmount` — the 90% or 85% destined for the cleaner
- `platformCommissionAmount` — Rena's 10% or 15% commission
- `platformFeeAmount` — the customer-paid 6% fee
- `totalAmountCharged` — what hit the customer's card

### 3.2 During escrow

Funds sit in Rena's platform balance. The cleaner sees the booking in their dashboard with status "Pending release" but no money in their Stripe Express balance.

### 3.3 At release

When release conditions (§5) are met, Rena initiates a **Transfer** from its platform balance to the cleaner's Express connected account, equal to `cleanerPayoutAmount`. Rena retains `platformCommissionAmount` and `platformFeeAmount`.

After transfer, the funds enter the cleaner's Express balance and are subject to Stripe's payout schedule (§9).

---

## 4. Customer payment

### 4.1 Checkout breakdown shown to customer

The customer sees a clear breakdown before paying:

```
Cleaner price:             £60.00
Platform fee (6%):          £3.60
──────────────────────────────────
Total:                     £63.60
```

### 4.2 Payment capture

Payments are captured immediately at booking. There is no separate authorise/capture step — when the customer clicks Pay, money moves.

### 4.3 PCI compliance

Rena never handles card details. Stripe Payment Elements (Stripe.js) collects and tokenises card data client-side. Rena's PCI obligation is SAQ A.

---

## 5. Escrow release rules

### 5.1 First-time customer-cleaner pairing

The first time a specific customer books a specific cleaner, Rena holds funds for a longer window to allow for trust-building.

- **Default release:** 24 hours after the scheduled job time
- **Early release:** Customer confirms job complete via their dashboard or via email link

The booking releases at whichever happens first.

### 5.2 Repeat pairing

Once a customer has successfully completed at least one prior booking with the same cleaner (no disputes, no refunds), subsequent bookings use a shorter window.

- **Default release:** 2 hours after the scheduled job time
- **Early release:** Customer confirms job complete

A pairing is considered "repeat" when there is at least one prior booking between the same `customerUserId` and `cleanerUserId` with a final status of `RELEASED` or `COMPLETED_NO_DISPUTE`.

### 5.3 Dispute window override

If the customer raises a dispute within the release window, the booking transitions to status `DISPUTED` and the funds remain in escrow until the dispute is resolved. The auto-release timer is paused.

Disputes can be raised:

- By the customer via "Report an issue" in their dashboard
- By a Stripe chargeback (system-generated)

Dispute resolution is handled by Rena admin staff via the admin dashboard.

### 5.4 Cleaner-marked completion

When the cleaner marks the job complete in their dashboard, this does **not** trigger fund release on its own. It records `cleanerMarkedCompleteAt` for the booking. The customer-confirm or auto-release rule still governs the actual release.

---

## 6. Cancellation & refund policy

### 6.1 Customer-initiated cancellation

The refund the customer receives depends on how far in advance they cancel relative to the scheduled job time.

| Time before scheduled job | Refund                                                  |
| ------------------------- | ------------------------------------------------------- |
| 48+ hours                 | 100% refund (cleaner price + platform fee)              |
| 24–48 hours               | 50% refund (50% of cleaner price + 50% of platform fee) |
| < 24 hours                | 0% refund. Cleaner paid in full. Platform fee retained. |

For partial refunds, the cleaner receives the remaining 50% of their share once the original scheduled time has passed.

### 6.2 Cleaner no-show

If the scheduled job time passes and the cleaner has not marked the job complete and the customer reports no-show:

- Customer receives 100% refund
- Cleaner receives nothing (no payout)
- Cleaner's reliability score (internal) takes a penalty
- Rena attempts to assign a backup cleaner for the customer (immediate or within a few days, depending on cleaner availability)

### 6.3 Cleaner-initiated cancellation (decline before job)

If the assigned cleaner declines a booking offer before the scheduled time:

- No charge to either party for the decline
- Rena triggers the backup cleaner cascade (§7)

### 6.4 Refund mechanics

All refunds use Stripe's refund API on the original PaymentIntent. The 6% platform fee follows the same percentage refund as the cleaner price (full cancellation = full platform fee refund; 50% cancellation = 50% platform fee refund; etc.).

For partial refunds, only the refunded portion of the cleaner's share is _not_ transferred at release. The unrefunded portion still releases normally to the cleaner.

---

## 7. Backup cleaner cascade

### 7.1 When the cascade triggers

The backup logic activates when:

- The primary cleaner declines the booking
- The primary cleaner no-shows
- Other (admin override)

### 7.2 Backup selection

Two modes the customer chooses at booking:

**Mode A — Customer-selected backups.** The customer ranks 2-3 cleaners in preference order at booking time. If the primary declines, Rena attempts each backup in turn. Backups may have different prices.

**Mode B — Rena selects.** The customer trusts Rena to assign a backup. Rena's backup selection is constrained to **cleaners whose price is less than or equal to the primary's price**. Never upcharges the customer.

### 7.3 Price reconciliation

When a backup at a different price accepts the job:

**If backup is cheaper than primary:**

- Customer automatically receives a refund for the difference (cleaner price + proportional 6% fee), subject to the threshold in §7.3.1
- Refunded via the same PaymentIntent as the original charge

**If backup is more expensive (only possible in Mode A — customer-selected):**

- Customer must give explicit consent before the additional charge is made
- A consent request is sent via email and shown in their dashboard
- If customer consents, the additional amount (price difference + 6% fee on that difference) is charged via a new PaymentIntent linked to the original booking, subject to the threshold in §7.3.1
- If customer declines or doesn't respond within 4 hours, Rena tries the next backup in queue

**In Mode B (Rena selects):**

- By design, Rena only selects a backup whose price is less than or equal to the primary's
- Customer always receives a refund (£0 if same price, positive if cheaper), subject to the threshold in §7.3.1
- Never an upcharge in Mode B

### 7.3.1 Discrepancy threshold and cleaner offer flow

To avoid operational noise from trivial price differences, refunds and upcharges are only processed when the absolute price difference between primary and backup is **greater than £3**.

**For differences of £3 or less:**

- No refund or upcharge is processed.
- The customer is charged the primary cleaner's price.
- If the backup is cheaper than the primary: Rena absorbs the £3-or-less difference (small uplift to commission).
- If the customer-selected backup is more expensive than the primary: the cleaner-offer flow below applies — the cleaner sees the actual rate they'll be paid and decides whether to accept.

**For differences greater than £3:**

- Standard refund or consent flow applies per §7.3.

**Cleaner offer flow (used when an offered job differs from the cleaner's listed rate):**

When a cleaner is offered a backup job at a rate different from their normal listed rate, the offer notification (email + in-app) shows:

- The customer's name and booking details
- **The actual amount the cleaner will be paid for this job** (i.e. 90% or 85% of the _effective price_, which may be lower than their listed rate if the discrepancy threshold is in effect)
- Whether this is a same-rate, cheaper, or higher-than-listed offer
- Buttons to Accept or Decline

A cleaner can decline a backup job without penalty (it does not affect their reliability score). Declining triggers the next backup in the cascade.

The cleaner is never paid less than their listed rate without seeing it first and explicitly accepting. This is a non-negotiable fairness rule for cleaners.

**Disclosure obligations:**

This rule must be disclosed in:

- Rena's terms and conditions (customer and cleaner)
- The booking flow's backup-selection screen (small explainer text for customers)
- The cleaner-side onboarding documentation (so cleaners understand the offer flow before they get their first one)

### 7.4 Booking record changes

When a backup takes a booking, the booking record is updated:

- `cleanerUserId` is updated to the backup cleaner
- `originalCleanerUserId` is stored
- `backupChainPosition` increments (1 = first backup tried, 2 = second, etc.)
- `backupReason` is set (PRIMARY_DECLINED, PRIMARY_NO_SHOW, etc.)
- `cleanerPayoutAmount` is recalculated to match the effective price (cleaner's actual pay)

---

## 8. Cleaner Stripe Connect onboarding

### 8.1 Timing in the cleaner journey

Cleaner onboarding to Stripe Connect happens **after** Rena's admin verification approves them. This avoids creating Stripe accounts for cleaners who will be rejected and reduces the upfront friction of the join flow.

Sequence:

1. Cleaner signs up via `/join` (existing flow)
2. Cleaner submits documents and selfie (existing flow)
3. Admin reviews and clicks **Verify** in the admin dashboard
4. Cleaner receives a verification approval email containing the Stripe Connect onboarding link
5. Cleaner clicks the link, completes Stripe Express onboarding (typically 5-10 minutes)
6. On completion, the cleaner is redirected back to their Rena dashboard
7. The cleaner can now accept bookings

### 8.2 Verification email

The cleaner verification approval email (the one already sent today) is extended to include:

- A "Connect your payment account to start earning" call-to-action
- A button linking to the Stripe Connect onboarding URL

### 8.3 Cleaner dashboard banner

Until the cleaner completes Stripe onboarding, the cleaner dashboard shows a prominent banner at the top:

> "Almost there! Connect your payment account to start receiving bookings."

The banner is dismissed only when the cleaner's Stripe account has `charges_enabled: true` and `payouts_enabled: true`.

### 8.4 Booking eligibility

The system enforces that a cleaner cannot appear in customer search results, cannot be selected as a primary or backup, and cannot accept bookings until both `stripeChargesEnabled` and `stripePayoutsEnabled` are true on their profile.

### 8.5 Onboarding flow technical notes

- Use `stripe.accounts.create({ type: 'express', country: 'GB' })` to create the connected account
- Use `stripe.accountLinks.create({ ... type: 'account_onboarding' })` to generate the hosted onboarding URL
- After onboarding, Stripe redirects to a configurable return URL on Rena
- Listen for `account.updated` webhook to update `stripeChargesEnabled` / `stripePayoutsEnabled` on the CleanerProfile

---

## 9. Cleaner payout schedule

### 9.1 First payout

Stripe holds the first payout of a new connected account for 7-14 days as a risk mitigation measure. This applies regardless of when funds are released from Rena's escrow. The cleaner sees the released funds in their Express balance immediately but they will not transfer to the cleaner's bank account until Stripe's hold expires.

This delay is communicated transparently in:

- The cleaner verification email
- The cleaner dashboard
- The "Become a cleaner" page (FAQs)

### 9.2 Ongoing payouts

After the first payout has cleared, cleaners are paid on a **weekly schedule, every Wednesday**. The weekly payout aggregates all funds that were released from escrow during the prior week (Wednesday-to-Tuesday window).

Stripe's payout schedule is set to `weekly`, with the anchor day set to Wednesday, during the Express account configuration.

### 9.3 Cleaner-initiated early payout

The "Manual payouts" feature in the Stripe Express dashboard is currently enabled (per the Connect settings configured June 2026). This allows cleaners to request payouts of released funds before the weekly Wednesday cycle, via their Stripe Express dashboard.

This is permitted but not prominently advertised in Rena's UI — it is an option for cleaners who need cash faster.

**Action item (for Harrison to verify):** Confirm the Manual payouts toggle is actually enabled in Stripe → Connect → Settings → Express Dashboard. If disabled, decide whether to enable it or update this section to reflect a "weekly only" payout model.

---

## 10. Data model changes

### 10.1 CleanerProfile additions

```prisma
model CleanerProfile {
  // ... existing fields

  // Pricing
  hourlyRateRegular     Decimal?     // £/hr for regular cleaning
  hourlyRateDeep        Decimal?     // £/hr for deep cleaning
  hourlyRateSameDay     Decimal?     // £/hr for same-day cleaning
  eotPrices             Json?        // {"studio": 150, "1bed": 190, "2bed": 250, ...}
  airbnbPrices          Json?        // {"studio": 45, "1bed": 55, "2bed": 75, ...}

  // Stripe Connect
  stripeAccountId       String?      @unique
  stripeChargesEnabled  Boolean      @default(false)
  stripePayoutsEnabled  Boolean      @default(false)
  stripeOnboardedAt     DateTime?
}
```

### 10.2 Booking additions

```prisma
model Booking {
  // ... existing fields

  // Stripe references
  stripePaymentIntentId      String?  @unique
  stripeChargeId             String?
  stripeTransferId           String?

  // Money breakdown (calculated at booking)
  cleanerPayoutAmount        Decimal  // 90% or 85% of cleaner's effective price (may differ from listed rate for backup jobs at threshold-absorbed differences)
  platformCommissionAmount   Decimal  // 10% or 15% of cleaner's effective price
  platformFeeAmount          Decimal  // 6% of cleaner's effective price (customer-paid)
  totalAmountCharged         Decimal  // Sum of above

  // Escrow lifecycle
  escrowReleaseScheduledAt   DateTime?  // 24h or 2h after scheduled job
  escrowReleasedAt           DateTime?
  customerConfirmedAt        DateTime?
  cleanerMarkedCompleteAt    DateTime?
  isFirstPairing             Boolean    // Calculated at booking creation

  // Backup tracking
  originalCleanerUserId      String?    // Set if cleaner was changed
  backupChainPosition        Int        @default(0)  // 0=primary
  backupReason               String?    // PRIMARY_DECLINED, PRIMARY_NO_SHOW, etc.

  // Dispute state
  disputedAt                 DateTime?
  disputeResolvedAt          DateTime?
  disputeResolution          String?    // REFUND_FULL, REFUND_PARTIAL, RELEASE_TO_CLEANER, etc.
}
```

### 10.3 New tables

```prisma
model StripeWebhookEvent {
  // For idempotency
  id          String   @id   // Stripe event ID
  type        String         // event.type from Stripe
  payload     Json
  processedAt DateTime @default(now())
}

model Dispute {
  id                String   @id @default(cuid())
  bookingId         String
  openedBy          String   // userId of customer
  reason            String
  description       String
  attachments       String[] // R2 object keys for evidence
  status            String   @default("OPEN")  // OPEN, RESOLVED, REJECTED
  resolution        String?
  resolvedBy        String?  // admin userId
  resolvedAt        DateTime?
  amountRefunded    Decimal?
  createdAt         DateTime @default(now())

  booking           Booking  @relation(...)
}
```

### 10.4 Booking status state machine

The Booking `status` enum expands to cover the new payment states:

```
PENDING_PAYMENT        — customer in checkout
PAID                   — customer paid, awaiting cleaner acceptance
ACCEPTED               — cleaner accepted
IN_PROGRESS            — current time is within the scheduled job window
CLEANER_MARKED_DONE    — cleaner clicked "mark complete" (does not release funds)
PENDING_RELEASE        — past scheduled time, in 24h/2h auto-release window
RELEASED               — funds transferred to cleaner
DISPUTED               — customer raised dispute, funds frozen
REFUNDED_FULL          — full refund issued
REFUNDED_PARTIAL       — partial refund issued (cleaner gets remainder)
CANCELLED_BY_CUSTOMER
CANCELLED_BY_CLEANER
NO_SHOW
```

---

## 11. Webhook events

Stripe webhook events Rena must handle. All have idempotency enforced via `StripeWebhookEvent` table.

### 11.1 Account lifecycle

| Event                | Action                                                                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `account.updated`    | Update `stripeChargesEnabled`, `stripePayoutsEnabled` on CleanerProfile. If both true and previously false, dismiss the dashboard banner. |
| `capability.updated` | Logged for audit; no action needed in MVP.                                                                                                |

### 11.2 Payment lifecycle

| Event                           | Action                                                                              |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| `payment_intent.succeeded`      | Transition booking from `PENDING_PAYMENT` to `PAID`. Trigger cleaner notification.  |
| `payment_intent.payment_failed` | Mark booking as failed. Notify customer to retry or use a different payment method. |
| `charge.refunded`               | Update booking with refund amount. If full refund, transition to `REFUNDED_FULL`.   |

### 11.3 Transfer lifecycle

| Event              | Action                                                          |
| ------------------ | --------------------------------------------------------------- |
| `transfer.created` | Update booking `stripeTransferId`. Log for audit.               |
| `transfer.failed`  | Critical: alert admin. Mark booking with transfer failure flag. |

### 11.4 Dispute lifecycle

| Event                             | Action                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `charge.dispute.created`          | Transition booking to `DISPUTED`. Notify admin via email. Pause any pending escrow release.                |
| `charge.dispute.closed`           | Update dispute outcome. If won, allow normal release. If lost, refund customer from Rena platform balance. |
| `charge.dispute.funds_withdrawn`  | Log for accounting.                                                                                        |
| `charge.dispute.funds_reinstated` | Log for accounting.                                                                                        |

---

## 12. Environment variables

### Required in Railway (and locally in `.env.local`)

```
# Test mode (for development)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Live mode (added at production cutover only)
# STRIPE_SECRET_KEY=sk_live_...
# STRIPE_PUBLISHABLE_KEY=pk_live_...
# STRIPE_WEBHOOK_SECRET=whsec_...
```

The boot-time validation (`src/instrumentation.ts` per the R2 work) is extended to verify all three Stripe env vars are present.

---

## 13. Security & compliance

- All Stripe API calls are server-side only. The secret key never reaches the browser.
- Webhook signature verification is mandatory on every webhook handler.
- Idempotency keys are used on all PaymentIntent creation and Transfer creation API calls.
- Customer card data never touches Rena's servers — Stripe Payment Elements handles client-side.
- PCI compliance: SAQ A (the simplest level, available because Stripe-hosted elements never expose card data to us).
- Rena's `accountStatus` and access tokens for the Stripe dashboard are restricted to admin role users only.
- Stripe API keys are stored in Railway environment variables, never committed to the repo.

---

## 14. Out of scope for this spec

The following are intentionally not covered. They may come later but are not part of the initial Stripe Connect migration:

- Subscription billing (recurring weekly/fortnightly clean charges as a subscription)
- Tipping
- Promo codes / discount coupons
- Customer wallet / credit balances
- Bulk discounts for end-of-tenancy multi-property bookings
- B2B accounts (companies booking on behalf of employees)
- International payouts (assumed UK-only initially)
- Tax form generation for cleaners (Stripe Tax handles UK self-assessment exports separately)

---

## 15. Open questions

Items that are decided in principle but need detail before relevant PRs:

- **Mode A vs Mode B selection UI.** How does the customer choose between "I pick backups" and "Rena picks"? Default? Where in the booking flow?
- **Customer consent flow for expensive backup.** Email or in-app push notification? What's the consent window length (suggested 4 hours)?
- **Dispute reason taxonomy.** Pre-defined list (`POOR_QUALITY`, `INCOMPLETE`, `NO_SHOW`, `DAMAGE`, `OTHER`) or free text?
- **Admin dispute resolution UI.** Build alongside Dispute table or in a separate PR?
- **Subscription pricing for repeat bookings.** Out of scope for MVP but should the data model anticipate it?

These are tracked separately and resolved during their respective PRs.

---

## 16. Implementation plan (high-level)

Implementation will proceed in 6 sequential PRs. Each PR ships independently and does not break what came before.

| PR  | Scope                                                                                      |
| --- | ------------------------------------------------------------------------------------------ |
| 1   | Cleaner pricing storage and management UI                                                  |
| 2   | Stripe Connect cleaner onboarding (post-admin-verification)                                |
| 3   | Ryft removal + Stripe Connect checkout (single-cleaner happy path)                         |
| 4   | Escrow release logic + cleaner completion + customer confirmation                          |
| 5   | Cancellation, refunds, backup cascade (including §7.3.1 £3 threshold + cleaner offer flow) |
| 6   | Disputes + admin dispute resolution UI                                                     |

Each PR's prompt to Claude Code references this spec as the source of truth for business decisions.

---

## Changelog

- **v1.2 (June 2026):** Updated §7.3.1 with the cleaner offer flow. Cleaners now see actual pay rate before accepting backup jobs at threshold-absorbed differences, and can decline without penalty. Updated §10.2 to clarify cleanerPayoutAmount uses effective price.
- **v1.1 (June 2026):** Added §7.3.1 discrepancy threshold (£3). Clarified §9.3 with verification action item. Updated PR 5 scope to include threshold logic.
- **v1.0 (June 2026):** Initial draft. All business decisions captured.
