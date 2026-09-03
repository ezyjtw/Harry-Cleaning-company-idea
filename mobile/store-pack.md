# Rena Pro — Store Submission Pack (DRAFT for James)

Documents only — nothing here is submitted until James edits and approves. Working
app name: **Rena Pro** (James-ruled 3 Sep 2026). Bundle ID `uk.co.renacleaning.pro`.
Privacy policy URL: **https://www.renacleaning.co.uk/en/privacy**
Support URL: **https://www.renacleaning.co.uk/en/contact** · support@renacleaning.co.uk

---

## 1. Store listing copy (James's voice — edit freely)

### App name / subtitle

- **App name:** `Rena Pro` — **James-ruled 3 Sep 2026** as the working name
  everywhere (app.json `expo.name` already carries it; store records use it when
  created). Changeable until first release if James revisits. _Parked note: the
  ruling was written "RENA PRO" — if the all-caps rendering is wanted as the
  store display name (rather than emphasis), say the word and it changes
  consistently._
- **App Store subtitle** (≤30 chars): `Cleaning jobs, on your terms`
- **Play short description** (≤80 chars): `Get cleaning jobs near you, set your own rates, and earn on your terms.`

> **App-name decision — RESOLVED (James, 3 Sep 2026): `Rena Pro`.** The
> customer-confusion risk decided it — "RENA Cleaners" reads ambiguously to a
> customer browsing the store; Rena Pro is unambiguously the worker app, and
> the customer app can later take plain "RENA".

### Full description ("earn on your terms" positioning)

> **Your cleaning work, your way.**
>
> Rena Pro is the app for independent cleaners on the Rena network. Get matched
> with customers near you, accept the jobs that suit you, and keep 90% of what you
> earn — you set your own rates and hours.
>
> **Built for your workday**
>
> - **Today** — every job for the day at a glance: time, customer, area, pay, and
>   one-tap "I'm on my way → Start → Complete" as you work.
> - **Job offers** — when a new job comes in, you get a notification with the pay,
>   time, and area up front. Accept or decline in a tap.
> - **Get paid** — funds are released within 24 hours of a completed job (often
>   instantly once your customer confirms), then paid to your bank on Stripe's
>   schedule.
> - **Everything in one place** — your schedule, earnings, messages, and
>   availability, all in the app.
>
> **Why cleaners choose Rena**
>
> - Keep 90% of your earnings — one of the lowest platform fees around.
> - Choose your own customers, rates, and hours.
> - Every customer is verified; payments are handled securely.
> - Face ID keeps your account private on your phone.
>
> Rena Pro is for vetted, self-employed cleaners on the Rena network. New to
> Rena? Apply at renacleaning.co.uk/join.

### Keywords

- **App Store** (single field, ≤100 chars, comma-separated, no spaces needed):
  `cleaner,cleaning jobs,housekeeping,self employed,gig,domestic cleaner,earnings,rota,house cleaning`
- **Play** (woven into the description — Play has no keyword field): cleaner jobs,
  cleaning work, self-employed cleaner, housekeeping jobs, domestic cleaning,
  flexible work, get paid.

### Category

- **Primary:** Business _(or Productivity)_ · **Secondary:** Lifestyle.

---

## 2. Privacy — derived honestly from the code

### What data the app actually touches

| Data                                                           | Where it's used                                            | Notes                                                                                                                                                                                                                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Account identity** — name, email, phone                      | Login; shown in profile/portal                             | Stored server-side (User). Login sends email+password to `/api/auth/login`.                                                                                                                                                             |
| **Bookings** — customer name, address, date/time, service, pay | Today + Offer + portal                                     | The cleaner sees the jobs assigned/offered to them.                                                                                                                                                                                     |
| **Messages** — cleaner ↔ customer                              | Messages tab (portal)                                      | First-party, between the two parties to a booking.                                                                                                                                                                                      |
| **Push token** — Expo device token                             | Registered on login to send job offers                     | Stored (DeviceToken); deleted on logout. **James-ruled 3 Sep 2026: declared in the labels NOW** (forward-honest) — the shipped binary is push-capable but registers no token until C7 activation; the label never needs touching again. |
| **Session cookie** — NextAuth session                          | Kept in the WebView to stay signed in                      | HttpOnly; on-device only. Bearer token in the Keychain for native calls.                                                                                                                                                                |
| **Home postcode + travel time**                                | Entered by the cleaner (text) to define their service area | **User-typed text, not device location.**                                                                                                                                                                                               |
| **First-party analytics** — funnel/usage events                | Product analytics on the web app                           | First-party only; no third-party ad/tracking SDKs.                                                                                                                                                                                      |

### Does any of it constitute "tracking" (Apple's definition)? **No.**

Apple defines tracking as linking user/device data with **third-party** data for
targeted advertising or measurement, or sharing with a **data broker**. Rena
Pro does **none** of that: no ad SDKs, no third-party analytics/attribution
SDKs, no data brokers. Payments run through **Stripe** (the customer side, on the
web); the app processes no card data natively. **No device location** is accessed
(the service-area postcode is typed text). Therefore **"Data Used to Track You: None."**

### Apple App Privacy labels (App Store Connect → App Privacy)

- **Data Used to Track You:** _None._
- **Data Linked to You** (collected + tied to identity):
  - **Contact Info** — name, email, phone.
  - **Financial Info** — **DECLARE YES.** The app surfaces the cleaner's
    **earnings / payout amounts** (Earnings screen, per-job pay). Collected,
    **linked to the user**, **not** used for tracking. Card/bank details
    themselves are **held by Stripe as our payment processor** — the app never
    handles them natively (state this in the review notes).
  - **User Content** — messages; job/booking details; (identity documents are
    uploaded via the web verification flow, not a native camera capture).
  - **Identifiers** — user ID; push token.
  - **Usage Data** — product interaction/analytics (first-party).
  - **Diagnostics** — crash/performance (if you enable any; otherwise omit).
- **Data Not Linked to You:** _None_ (or Diagnostics if anonymised).

### Google Play Data Safety form

- **Data collected:** Personal info (name, email, phone), **Financial info
  (earnings/payout amounts — collected, linked to the user, not for ads)**,
  Messages, App activity (usage), Device IDs (push token). **Location: No** (no
  device location).
- **Data shared with third parties:** **Stripe** (payments/payouts) — bank/card
  details are collected and held by Stripe as our processor. No sharing for
  advertising, no data brokers.
- **Security:** data encrypted in transit (HTTPS/TLS). Users can request deletion
  (GDPR erasure flow — link the privacy policy; the app/portal supports account
  deletion requests).
- **Data deletion:** yes — via the account/privacy flow on the platform.

---

## 3. Apple review notes (App Store Connect → App Review Information → Notes)

### Reviewer paragraph

> Rena Pro is the companion app for **verified, self-employed cleaners** on the
> Rena Cleaning Network (a UK cleaning marketplace). Cleaners use it to see their
> day's jobs, receive and accept/decline new job offers via push, manage their
> availability and earnings, and message customers. Account management and detailed
> views are presented in an embedded, authenticated web layer; the Today and Offer
> screens and the app's navigation, notifications, and Face ID are native. Payments
> and payouts are handled by **Stripe**; the app displays the cleaner's earnings but
> never handles card or bank details itself. A demo cleaner account with live jobs
> and a pending offer is provided below so you can exercise the full flow.

### 4.2 positioning line (per the Phase-0 survival plan)

> This is a native workday companion for self-employed cleaners — real-time job
> offers via push, a purpose-built day view with inline job actions, and secure
> biometric access — not a repackaged website. The Today and Offer screens and push
> are the core native experience.

### Reviewer account — STAGED FAMILY ACCOUNT (James-ruled 3 Sep 2026; seed script struck)

No seed script. The reviewer logs into a designated **family account — Charlie,
unless James says otherwise** — staged immediately before submission:

- The account is already a **verified, active, Stripe-enabled** cleaner with
  coverage set — nothing to build.
- **Pre-submission staging step (owner: Fable, fired on James's word):**
  immediately before submission, stage on Charlie's account —
  **2 fresh today-jobs** in lifecycle states (ACCEPTED/EN_ROUTE) so Today shows
  tappable "I'm on my way → Start" rows, and **1 live offer** (PRIMARY_OFFER)
  with a **future `cascadeExpiresAt`** so `/app/offer/[id]` shows a running
  countdown with working Accept/Decline (against throwaway bookings).
- Login: Charlie's email + password in the App Review Information fields.
- Practical note: offers expire — stage as close to the submission click as
  possible, keep a spare today-job in case one gets completed during review,
  and re-stage on any resubmission.

---

## 4. Asset spec

### Icon

- **1024×1024 PNG**, no alpha, no rounded corners (Apple rounds it).
- **The option-B RENA Cleaner lockup, untouched, on light (`#FAFBFC`)** — centered,
  with comfortable padding (James-ruled: light ground, never navy). Android
  adaptive icon: same mark as the **foreground** on a `#FAFBFC` background layer
  (keep the mark within the safe center ~66%).

### Splash

- Same lockup centered on `#FAFBFC` (matches `app.json` splash background — the
  arrival is light end-to-end).
- Provide a high-res PNG (~1284×2778 covers the tallest iPhone); Expo scales with
  `resizeMode: contain`.

### Store screenshot shot-list (capture once P1 is walkable on-device)

Take these on the demo account (real data):

1. **Today — a full day** ("You have 3 jobs today") with the lifecycle buttons.
2. **A job in progress** (Start/Complete visible) + the next-job countdown.
3. **Offer screen** — pay prominent + the amber/danger countdown.
4. **This week** view — day headers + the earnings strip.
5. **Earnings** (portal) — the net-first "You'll receive £X".

Device sizes required:

- **iPhone 6.7"** (1290×2796) — required.
- **iPhone 6.5"** (1242×2688) — required for older listings (or reuse 6.7").
- **iPad** — only if you ship iPad support (currently `supportsTablet: false`, so
  **not required**).
- **Play**: phone screenshots (min 2, up to 8), 16:9 or 9:16, ≥1080px on the short side; a 1024×500 feature graphic.

---

## Checklist before James submits

- [x] App name: **Rena Pro** (ruled 3 Sep 2026) — set consistently in both stores when records are created.
- [ ] Edit the description + subtitle + keywords into James's voice.
- [ ] Fill the Apple App Privacy + Play Data Safety forms from §2 — push token
      DECLARED now per the 3 Sep ruling (option a, forward-honest); confirm the
      Stripe/financial classification.
- [ ] **Stage the reviewer account (owner: Fable, on James's pre-submission
      word):** Charlie's account gets 2 fresh today-jobs in lifecycle states +
      1 live offer with future expiry, staged immediately before the submission
      click (§3). James puts Charlie's credentials in App Review notes.
- [x] Splash re-exported 1284×2778 (3 Sep 2026). Icon + adaptive icon already
      committed.
- [ ] Screenshots (§4) from the P1 build on the staged account.
- [ ] Confirm the privacy-policy + support URLs resolve.
