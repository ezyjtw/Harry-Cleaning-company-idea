# Rena Cleaning Marketplace — Prioritised Startup Backlog

> Generated from full codebase + viability review. Ordered by launch-readiness impact.

---

## Phase 1: Must Fix Before Pilot (City-level alpha test)

These are hard blockers. Without these, you cannot safely put real users through the system.

### 1.1 Auth & Security (CRITICAL)
- [x] Replace plain-text password comparison with bcrypt in `src/lib/auth/options.ts`
- [x] Implement real `registerUser()` in `auth.service.ts` — hash password, check for existing email, insert into DB, send verification email
- [x] Implement real `loginUser()` — DB lookup, bcrypt compare, update lastLoginAt
- [x] Implement real `requestPasswordReset()` — generate secure token, store in DB, send email
- [x] Implement real `resetPassword()` — validate token + expiry, hash new password, update DB
- [x] Implement real `verifyEmail()` — validate token, mark emailVerified
- [x] Implement real `changePassword()` — verify current, hash new, update DB
- [x] Implement real `deleteAccount()` — soft-delete, cancel bookings, GDPR compliance
- [x] Remove hardcoded `dev-secret-change-in-production` fallback — require NEXTAUTH_SECRET env var
- [x] Add failed login counting + account lockout (already have `failedLoginCount` and `lockedUntil` in schema)
- [x] Add rate limiting middleware on auth endpoints (e.g. 5 attempts per 15 min per IP)

### 1.2 Missing API Routes (App Contract Gaps)
- [x] `POST /api/auth/login` — mobile app login endpoint
- [x] `POST /api/auth/signup` — mobile app registration endpoint
- [x] `GET /api/auth/profile` — return current user profile
- [x] `GET /api/notifications` — list user notifications
- [x] `PUT /api/notifications/[id]/read` — mark notification as read
- [x] `GET /api/addresses` + `POST /api/addresses` — saved addresses CRUD
- [x] `POST /api/reviews` — submit a review for a booking
- [x] `GET /api/cleaners/[id]/reviews` — get reviews for a specific cleaner
- [x] `GET /api/bookings/[id]` — get a single booking by ID

### 1.3 Replace Mock Data in Core API Routes
- [x] `src/app/api/cleaners/[id]/route.ts` — use Prisma instead of `getCleanerById` from mock-data
- [x] `src/app/api/bookings/route.ts` — remove `getCleanerById` mock import
- [x] `src/app/api/estimate/route.ts` — use Prisma for cleaner lookups
- [x] `src/app/cleaners/page.tsx` — fetches from `/api/cleaners` with loading state
- [x] `src/app/cleaners/[id]/page.tsx` — server component using Prisma directly
- [x] `src/app/services/[category]/page.tsx` — uses `useCleanersApi` hook
- [x] `src/app/book/[id]/page.tsx` — uses `useCleanersApi` hook + fetches addresses/bookings from API
- [x] `src/components/CleanerProfileModal.tsx` — fetches reviews from `/api/cleaners/[id]/reviews`
- [ ] `src/app/dashboard/page.tsx` — inline mock data (Phase 2: admin tooling)
- [ ] `src/app/disputes/page.tsx` — uses `MOCK_DISPUTES` from trust.ts (Phase 2: admin tooling)

### 1.4 One Complete Booking Flow (End-to-End Real)
- [x] Customer signup → email verification → login
- [x] Browse cleaners (from DB) → select cleaner → get quote (from pricing engine)
- [ ] Create booking → payment auth via Ryft → payment captured
- [x] Cleaner notified → accepts job → checks in → completes
- [x] Customer notified → leaves review
- [x] Cleaner earnings updated

---

## Phase 2: Must Fix Before Public Launch

These can wait for alpha but must be done before you open up to real paying customers.

### 2.1 Payment Hardening
- [ ] Remove mock payment fallback — require `RYFT_SECRET_KEY` for all environments
- [ ] Implement proper webhook signature verification
- [ ] Handle payment failures gracefully with customer notifications
- [ ] Implement refund flow through Ryft API
- [ ] Test escrow hold → release → partial refund cycle

### 2.2 Admin & Ops Tooling
- [ ] Real admin dashboard with live booking/revenue data from DB
- [ ] Dispute management — view, investigate, resolve with audit trail
- [ ] Cleaner verification queue — review DBS certs, right-to-work docs
- [ ] Manual booking override (admin rebooking, cancellation, refund)
- [ ] Complaint resolution workflow with evidence attachments

### 2.3 Messaging & Notifications
- [ ] Real-time messaging between customer and cleaner (WebSocket or polling)
- [ ] Push notification infrastructure (FCM for mobile apps)
- [ ] Email notifications for booking lifecycle events
- [ ] SMS fallback for critical notifications (booking confirmed, cleaner en route)

### 2.4 Cleaner Onboarding
- [ ] Complete DBS verification integration (not just stub)
- [ ] Right-to-work document upload + admin verification
- [ ] Profile photo upload + storage
- [ ] Background check status tracking
- [ ] Onboarding checklist / progress tracker

### 2.5 Frontend Mock Data Removal
- [ ] Remove all `@/lib/mock-data` imports from page components
- [ ] Wire all client-side pages to real API endpoints
- [ ] Ensure SSR pages use Prisma directly or API calls

### 2.6 Testing & Build Verification
- [ ] Verify full test suite passes
- [ ] Add integration tests for critical booking flow
- [ ] Add auth endpoint tests
- [ ] Set up CI to block merges on test failure
- [ ] E2E test for signup → book → pay → complete cycle

---

## Phase 3: Can Wait Until Post-PMF

These are real features but they don't block proving the business model.

### 3.1 Advanced Pricing
- [ ] Surge pricing engine (already has service file, needs real triggers)
- [ ] Dynamic zone-based pricing from DB
- [ ] Promo codes / referral discounts
- [ ] Subscription/package pricing for recurring cleans

### 3.2 Cleaner Matching Intelligence
- [ ] Improve matching algorithm with real performance data
- [ ] Route optimisation for cleaners with multiple jobs
- [ ] Availability forecasting
- [ ] Auto-assignment based on fill rates and cleaner preferences

### 3.3 Company/Team Features
- [ ] Multi-cleaner company onboarding
- [ ] Team management dashboard
- [ ] Company-level analytics and reporting
- [ ] Shared calendar / job assignment within teams

### 3.4 Analytics & Growth
- [ ] Funnel analytics dashboard (conversion tracking is partially built)
- [ ] Abandonment email automation (endpoint exists, needs real email sending)
- [ ] Customer LTV tracking
- [ ] Cleaner retention metrics
- [ ] A/B testing framework for booking flow

### 3.5 GDPR & Compliance Polish
- [ ] Automated data retention enforcement
- [ ] ICO registration status dashboard
- [ ] Cookie consent management
- [ ] Data processing agreement tracking
- [ ] Breach incident response automation

### 3.6 Mobile App Polish
- [ ] Offline-first data caching
- [ ] Background location for cleaner ETA
- [ ] In-app rating prompts
- [ ] Deep linking for notifications
- [ ] App Store / Play Store submission prep

---

## Economics Validation (Parallel to All Phases)

These are not code tasks. They are business metrics to track from day one.

| Metric | Target | Why It Matters |
|--------|--------|----------------|
| Customer Acquisition Cost | < £30 | Must be recoverable within 3 bookings |
| Repeat booking rate | > 40% within 60 days | Proves sticky demand, not just curiosity |
| Cleaner fill rate | > 70% of available slots | Below this, cleaners leave |
| Cleaner 90-day retention | > 60% | Supply churn kills marketplaces |
| Gross margin after fees/refunds | > 15% | 10% platform fee is tight — monitor closely |
| NPS | > 40 | Trust is the product |
| Support tickets per 100 bookings | < 15 | Ops overhead must stay lean at 10% fee |

---

## Recommended Go-to-Market Wedge

**Dense geography + recurring home cleans + premium trust layer**

- Pick 3-5 adjacent postcodes (e.g. SW11, SW4, SW9, SE5, SE24)
- Recruit 5-10 vetted cleaners in that area
- Target: busy professionals, 2-bed+ flats, fortnightly cleans
- Channel: local Facebook groups, Nextdoor, Google Local Services
- Pricing: £18-25/hr to customer, test at 12-15% fee (not 10%)
- Prove repeat rate + cleaner retention before expanding geography
