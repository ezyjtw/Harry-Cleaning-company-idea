# Rena Cleaning Network — Codebase Inventory

## 1. Data Models (Prisma Schema)

### Enums

| Enum | Values |
|------|--------|
| **Role** | `CLIENT`, `CLEANER`, `ADMIN` |
| **CleanerTier** | `STARTER`, `BRONZE`, `SILVER`, `GOLD`, `ELITE` |
| **BookingStatus** | `PENDING`, `CONFIRMED`, `ACCEPTED`, `EN_ROUTE`, `IN_PROGRESS`, `COMPLETED`, `REVIEWED`, `CANCELLED`, `DISPUTED` |
| **PricingModel** | `HOURLY`, `FIXED` |
| **PropertySize** | `STUDIO`, `ONE_BED`, `TWO_BED`, `THREE_BED`, `FOUR_BED`, `FIVE_PLUS` |
| **BookingFrequency** | `WEEKLY`, `FORTNIGHTLY`, `ONE_OFF` |
| **PaymentStatus** | `PENDING`, `SUCCEEDED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED` |
| **CleanerQueueStatus** | `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `SUPERSEDED` |
| **DisputeStatus** | `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `DISMISSED` |
| **NotificationType** | `BOOKING_REQUEST`, `BOOKING_CONFIRMED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED`, `PAYMENT_RECEIVED`, `PAYMENT_SENT`, `NEW_MESSAGE`, `NEW_REVIEW`, `DISPUTE_OPENED`, `DISPUTE_RESOLVED`, `ACCOUNT_UPDATE`, `SYSTEM` |
| **VerificationStatus** | `UNVERIFIED`, `PENDING`, `VERIFIED`, `REJECTED` |
| **AccountStatus** | `ACTIVE`, `SUSPENDED`, `DEACTIVATED` |
| **ReviewVisibility** | `VISIBLE`, `HIDDEN`, `FLAGGED` |
| **ProviderType** | `INDIVIDUAL`, `COMPANY` |
| **CompanyVerificationStatus** | `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED` |
| **TeamMemberRole** | `OWNER`, `MANAGER`, `CLEANER` |
| **ComplaintCategory** | `NO_SHOW`, `POOR_QUALITY`, `PROPERTY_DAMAGE`, `INCORRECT_DURATION`, `SAFETY_CONCERN`, `PAYMENT_ISSUE`, `UNPROFESSIONAL`, `OTHER` |
| **ComplaintSeverity** | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| **EvidenceType** | `PHOTO`, `VIDEO`, `TEXT`, `DOCUMENT` |

### Models

#### User (core identity — serves as both customer and cleaner)
| Field | Type | Notes |
|-------|------|-------|
| id | String | @id @default(cuid()) |
| email | String | @unique |
| passwordHash | String? | |
| name | String? | |
| phone | String? | |
| role | Role | @default(CLIENT) |
| emailVerified | DateTime? | |
| image | String? | |
| accountStatus | AccountStatus | @default(ACTIVE) |
| isDeleted | Boolean | @default(false) |
| deletedAt | DateTime? | |
| lastLoginAt | DateTime? | |
| emailVerifiedAt | DateTime? | |
| failedLoginCount | Int | @default(0) |
| isSuspended | Boolean | @default(false) |
| lockedUntil | DateTime? | |
| createdAt / updatedAt | DateTime | auto |

**Relations:** accounts, sessions, cleanerProfile?, addresses[], bookingsAsClient[], bookingsAsCleaner[], reviewsGiven[], reviewsReceived[], sentMessages[], receivedMessages[], notifications[], disputesRaised[], ownedCompany?, teamMemberships[], complaints[], cleanerQueueEntries[], pushSubscriptions[]

#### CleanerProfile (one-to-one with User where role=CLEANER)
| Field | Type | Notes |
|-------|------|-------|
| id | String | @id @default(cuid()) |
| userId | String | @unique |
| bio | String? | @db.Text |
| hourlyRate | Decimal | @default(15.00) |
| specialties | String[] | |
| languages | String[] | |
| serviceTypes | String[] | |
| serviceRates | Json? | |
| hoursPerWeek | Int? | |
| yearsExperience | Int? | |
| tier | CleanerTier | @default(STARTER) |
| verified | Boolean | @default(false) |
| documentsUploaded | Boolean | @default(false) |
| backgroundCheckPassed | Boolean | @default(false) |
| dbsCertVerified | Boolean | @default(false) |
| dbsCertNumber / dbsCertIssueDate / dbsCertDestroyedAt | String? / DateTime? | |
| location | String? | |
| latitude / longitude | Float? | |
| radius | Int | @default(10) |
| travelMode | String | @default("public_transport") |
| availableNow | Boolean | @default(false) |
| responseTime | Int? | |
| completedJobs | Int | @default(0) |
| rating | Decimal | @default(0) |
| serviceRadius | Int | @default(10) |
| travelFee | Decimal | @default(0) |
| cancellationRate / completionRate | Decimal | |
| responseSpeed | Int? | |
| postcode | String? | |
| ryftAccountId | String? | |
| verificationStatus | VerificationStatus | @default(UNVERIFIED) |
| identityVerifiedAt | DateTime? | |
| verificationMeta | Json? | |
| totalJobsCompleted | Int | @default(0) |
| availabilitySummary | String? | |
| insuranceVerified | Boolean | @default(false) |
| insuranceExpiresAt / insuranceVerifiedAt | DateTime? | |
| rightToWorkStatus | VerificationStatus | @default(UNVERIFIED) |
| rightToWorkDocType / rightToWorkDocFile / rightToWorkShareCode | String? | |
| rightToWorkExpiresAt / rightToWorkVerifiedAt | DateTime? | |
| testimonials | Json? | |
| providerId | String? | |

**Relations:** user, provider?, availabilitySlots[], availabilityOverrides[], rateModifiers[]

#### Booking
| Field | Type | Notes |
|-------|------|-------|
| id | String | @id @default(cuid()) |
| clientId | String? | nullable for guest bookings |
| cleanerId | String | |
| addressId | String? | |
| guestEmail / guestName / guestPhone | String? | for unauthenticated customers |
| guestToken | String? | @unique |
| serviceType | String | |
| status | BookingStatus | @default(PENDING) |
| date | DateTime | |
| startTime | String | |
| duration | Decimal | |
| rooms | Json? | |
| extras | String[] | |
| frequency | String? | |
| totalPrice / platformFee / cleanerEarnings | Decimal | |
| notes | String? | |
| acceptedAt / checkedInAt / completedAt / cancelledAt | DateTime? | |
| cancellationReason / cleanerNotes / adminNotes | String? | |
| checklistCompleted / arrivalConfirmed | Boolean | |
| providerId | String? | |
| cleanerHourlyRate / cleanerDeepRate | Float? | |
| propertySize | PropertySize? | |
| bookingFrequency | BookingFrequency? | |
| serviceMultiplier | Float? | |
| cleanerGross / cleanerFee / cleanerEarns | Float? | |
| customerSubtotal / customerServiceFee | Float? | |
| addonTotal | Float? | @default(0) |
| renaEarns | Float? | |
| isQueuedBooking | Boolean | @default(false) |
| escrowAmount / escrowRefundAmount | Float? | |
| acceptedFromQueue | Boolean | @default(false) |

**Relations:** client?, cleaner, address?, provider?, review?, messages[], payment?, dispute?, complaints[], bookingAddons[], cleanerQueue[]

#### Address
| Field | Type | Notes |
|-------|------|-------|
| id, userId, label?, line1, line2?, city, postcode, isDefault | — | Standard address fields |

#### Review
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId (@unique), clientId, cleanerId | — | Links booking to reviewer and reviewee |
| rating, thoroughness?, punctuality?, communication? | Decimal | Category ratings |
| text?, reply? | String? | Review content and cleaner reply |
| isModerated, visibility, isVerifiedBooking, isDisputed | — | Moderation flags |

#### Payment
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId (@unique), ryftPaymentId? (@unique) | — | |
| amount, status, refundAmount? | — | Ryft payment tracking |
| discountPercent?, discountAmount?, promoCode? | — | |

#### Message
| Field | Type | Notes |
|-------|------|-------|
| id, senderId, receiverId, bookingId?, content, read | — | User-to-user messaging |

#### Notification
| Field | Type | Notes |
|-------|------|-------|
| id, userId, type (NotificationType), title, body, read, data? | — | In-app notifications |

#### Dispute
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId (@unique), raisedById, reason, description, status, resolution? | — | |
| **Relations:** evidence[] (DisputeEvidence) | | |

#### Complaint
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId, filedById, category, severity, subject, description | — | |
| status, resolution?, refundAmount?, isRedoClean | — | |
| **Relations:** evidence[] (ComplaintEvidence) | | |

#### AvailabilitySlot
| Field | Type | Notes |
|-------|------|-------|
| id, cleanerProfileId, dayOfWeek (Int), startTime, endTime | — | Recurring weekly slots |

#### AvailabilityOverride
| Field | Type | Notes |
|-------|------|-------|
| id, cleanerProfileId, date, isBlocked, startTime?, endTime?, reason? | — | Single-date overrides |

#### RateModifier
| Field | Type | Notes |
|-------|------|-------|
| id, cleanerProfileId, date, modifierPercent, reason? | — | Per-date rate adjustments |

#### ServiceType
| Field | Type | Notes |
|-------|------|-------|
| id, slug (@unique), name, pricingModel, baseMultiplier, minimumHours?, minimumCharge?, isActive | — | |
| **Relations:** fixedPrices[], addons[] | | |

#### FixedServicePrice
| Field | Type | Notes |
|-------|------|-------|
| id, serviceTypeId, propertySize, estimatedHours, customerPrice | — | Unique on [serviceTypeId, propertySize] |

#### ServiceAddon
| Field | Type | Notes |
|-------|------|-------|
| id, serviceTypeId, name, price, isActive | — | |

#### BookingAddon
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId, addonId, price | — | Unique on [bookingId, addonId] |

#### BookingCleanerQueue
| Field | Type | Notes |
|-------|------|-------|
| id, bookingId, cleanerId, rank, status (CleanerQueueStatus) | — | Top-3 cleaner matching |
| quotedTotal, cleanerEarns, matchScore | Float | |
| notifiedAt?, respondedAt?, expiresAt? | DateTime? | |

#### PlatformConfig
| Field | Type | Notes |
|-------|------|-------|
| id, key (@unique), value, description? | — | Key-value platform settings |

#### PromoCode
| Field | Type | Notes |
|-------|------|-------|
| id, code (@unique), discountPercent, maxUses?, usedCount, validFrom, validUntil?, isActive | — | |

#### PricingRule / PricingZone
Configurable pricing multipliers by name/date-range and by postcode prefix.

#### Company
| Field | Type | Notes |
|-------|------|-------|
| id, ownerId (@unique), name, description?, registrationNumber? | — | Cleaning company entity |
| verificationStatus, staffCount, operatingAreas[], specialties[] | — | |
| **Relations:** owner (User), provider?, team[] (TeamMember) | | |

#### Provider
| Field | Type | Notes |
|-------|------|-------|
| id, type (ProviderType), companyId? (@unique) | — | Bridges Company to CleanerProfiles and Bookings |

#### TeamMember
| Field | Type | Notes |
|-------|------|-------|
| id, companyId, userId, role (TeamMemberRole), isActive, canAcceptJobs | — | Unique on [companyId, userId] |

#### GDPR / Compliance Models
- **GdprConsent** — consent records per user/email/type
- **DataRetentionLog** — entity deletion/anonymisation audit trail
- **DataDeletionRequest** — GDPR Article 17 requests
- **DocumentUpload** — encrypted document storage with verification workflow
- **DpaAgreement** — data processing agreements with third parties
- **BreachIncident** — ICO breach reporting
- **IcoRegistration** — ICO registration tracking

#### Other Models
- **Account / Session / VerificationToken** — NextAuth tables
- **AuditLog** — action audit trail
- **BackgroundJob** — async job queue
- **AbandonedLead** — booking funnel drop-off recovery
- **AnalyticsEvent** — event tracking
- **PushSubscription** — web push subscriptions

---

## 2. Auth Setup

### NextAuth Configuration (`src/lib/auth/options.ts`)

- **Provider:** Single `CredentialsProvider` (email + password). No social providers.
- **Strategy:** JWT-based sessions (`session: { strategy: 'jwt' }`)
- **Password:** bcrypt with 12 salt rounds

**Session shape (exposed to client):**
```ts
session.user = {
  id: string;
  email: string;
  name: string;
  role: 'CLIENT' | 'CLEANER' | 'ADMIN';
}
```

**Authorization logic:** Checks `accountStatus === 'ACTIVE'` and `!isSuspended`. Account lockout after 5 failed attempts for 15 minutes.

### Auth Service (`src/lib/services/auth.service.ts`)

| Function | Purpose |
|----------|---------|
| `registerUser()` | Creates User (+ CleanerProfile if role=CLEANER). Password policy enforced. Sends verification email. |
| `loginUser()` | Validates credentials, enforces lockout. |
| `requestPasswordReset()` | Generates 1-hour reset token. Generic response prevents email enumeration. |
| `resetPassword()` | Validates token, enforces password policy. |
| `verifyEmail()` | Marks emailVerified. |
| `changePassword()` | Requires current password, enforces policy. |
| `deleteAccount()` | GDPR soft-delete: anonymises PII, cancels active bookings, creates audit log. |

### Route Protection

**Middleware (`src/middleware.ts`):**
- Protected routes: `/dashboard`, `/account`, `/admin` — redirects unauthenticated users to `/login`
- Auth routes: `/login`, `/register`, `/forgot-password` — redirects authenticated users to `/dashboard`

**Server-side session guards (`src/lib/auth/session.ts`):**

| Helper | Behaviour |
|--------|-----------|
| `getCleanerSession()` | Returns user if role=CLEANER, else null |
| `getAdminSession()` | Returns user if role=ADMIN, else null |
| `requireAuth()` | Throws 401 if not authenticated |
| `requireAdmin()` | Throws 403 if not admin |

**Client-side (`src/hooks/useAuth.ts`):**
```ts
{ user, isLoading, isAuthenticated, isClient, isCleaner, isAdmin, signIn, signOut }
```

### Role-based redirects after login
- CLEANER → `/cleaner`
- ADMIN → `/admin`
- CLIENT → `/dashboard`

---

## 3. API Routes

### Auth
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | No | NextAuth handler |
| `/api/auth/signup` | POST | No | Register user (CLIENT or CLEANER). Rate-limited 3/hr. |
| `/api/auth/login` | POST | No | Credential login. Rate-limited 5/15min. |
| `/api/auth/profile` | GET, PUT | Yes | Get/update authenticated user profile |
| `/api/auth/forgot-password` | POST | No | Request password reset. Rate-limited 3/hr. |
| `/api/auth/change-password` | POST | Yes | Change password (requires current password) |

### Cleaner Profile & Dashboard
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cleaner/profile` | GET, PUT | CLEANER | Get/update cleaner profile (bio, rates, specialties, location, travel mode) |
| `/api/cleaner/dashboard` | GET | CLEANER | Dashboard metrics: today's jobs, earnings, rating, upcoming jobs |
| `/api/cleaner/availability` | GET, PUT | CLEANER | Manage weekly slots, blocked dates, availableNow toggle |
| `/api/cleaner/jobs` | GET | CLEANER | List cleaner's bookings with status filter |
| `/api/cleaner/jobs/[id]` | GET, PATCH | CLEANER | Job details; update status (PENDING→ACCEPTED→EN_ROUTE→IN_PROGRESS→COMPLETED) |
| `/api/cleaner/earnings` | GET | CLEANER | Earnings by period (week/month/year) |
| `/api/cleaner/insurance` | GET, POST | CLEANER | View/upload insurance documents |
| `/api/cleaner/reviews` | GET, PATCH | CLEANER | View reviews; reply to a review |
| `/api/cleaner/rate-modifiers` | GET, POST, DELETE | CLEANER | Per-date rate adjustments (-50% to +200%) |

### Cleaner Directory & Onboarding
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/cleaners` | GET | No | List verified cleaners (postcode, specialty, available_now filters) |
| `/api/cleaners` | POST | No | Create cleaner or upgrade existing CLIENT to CLEANER |
| `/api/cleaners/[id]` | GET | No | Public cleaner profile |
| `/api/cleaners/[id]/rate-for-date` | GET | No | Effective hourly rate for a date |
| `/api/cleaners/[id]/reviews` | GET | No | Up to 50 visible reviews |
| `/api/cleaners/onboarding` | POST | No | Full onboarding with multipart documents (max 10MB/file) |
| `/api/cleaners/payout` | GET, POST | CLEANER | Ryft Connect payout account setup |
| `/api/cleaners/documents` | POST | CLEANER | Upload identity/RTW/DBS documents |

### Bookings
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/bookings` | GET | Yes | List bookings (role-filtered: clients see own, cleaners see assigned) |
| `/api/bookings` | POST | Yes (optional for guests) | Create booking with promo code support |
| `/api/bookings/[id]` | GET | Yes | Booking details (client, cleaner, or admin only) |
| `/api/bookings/guest` | GET, DELETE | No (token) | Get/cancel guest booking by guestToken |
| `/api/bookings/queue` | POST | No | Create queued booking, match top-3 cleaners |
| `/api/bookings/queue/accept` | POST | CLEANER | Accept job from queue |
| `/api/bookings/queue/reject` | POST | CLEANER | Reject job from queue |
| `/api/bookings/queue/status` | GET | No | Queue status for a booking |

### Payments
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/payments` | GET, POST | Yes | Create Ryft payment session / check session status |
| `/api/payments/webhook` | POST | No (signature) | Ryft webhook (captured, approved, failed, refunded) |

### Reviews
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/reviews` | POST | CLIENT | Submit review for completed booking |

### Addresses
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/addresses` | GET, POST | Yes | List/create saved addresses |
| `/api/addresses/[id]` | DELETE, PATCH | Yes | Delete address / set default |

### Messages
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/messages` | GET, POST | Yes | List conversations / send message |
| `/api/messages/[partnerId]` | GET | Yes | Message thread with partner (auto-marks read) |

### Notifications
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/notifications` | GET | Yes | Last 50 notifications |
| `/api/notifications/[id]/read` | PUT | Yes | Mark notification read |

### Complaints & Disputes
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/complaints` | GET, POST | Yes | File complaint / list own complaints |
| `/api/complaints/[id]` | GET, PUT | Yes (PUT=ADMIN) | View details / resolve complaint |
| `/api/complaints/[id]/evidence` | GET, POST | Yes | List/add evidence |

### Verification
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/verification/dbs` | GET, POST | CLEANER | DBS status / submit DBS actions |

### Admin
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/admin/pricing/config` | GET, POST | ADMIN | Platform pricing config |
| `/api/admin/compliance` | GET, POST | ADMIN | Compliance dashboard, DPA, breach management |
| `/api/admin/rtw` | GET, POST | ADMIN | Right-to-work expiry alerts, suspend expired |
| `/api/admin/documents` | GET, PATCH, DELETE | ADMIN | Review/approve/destroy uploaded documents |

### Company
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/companies` | GET, POST | Yes | Create company / list companies |
| `/api/companies/mine` | GET | Yes | Get own company |
| `/api/companies/[id]` | GET, PUT, DELETE | Yes | Company details / update / deactivate |
| `/api/companies/[id]/team` | GET, POST | Yes | List/add team members |
| `/api/companies/[id]/team/[userId]` | PATCH, DELETE | Owner/Admin | Update/remove team member |
| `/api/companies/[id]/bookings` | GET, PATCH | Yes | Company bookings / assign to member |
| `/api/companies/[id]/dashboard` | GET | Yes | Company dashboard metrics |
| `/api/companies/[id]/analytics` | GET | Yes | Company analytics |

### Pricing & Quotes
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/pricing/services` | GET | No | Active service types with prices and add-ons |
| `/api/pricing/quote` | POST | No | Calculate quote for service |
| `/api/estimate` | GET, POST | No | Quick estimate for hero quote widget |
| `/api/promo/validate` | POST | No | Validate promo code |

### Marketing & Funnel
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/leads` | POST | No | Capture quote-form lead. Rate-limited 10/hr. |
| `/api/waitlist` | POST | No | Add to out-of-area waitlist. Rate-limited 10/hr. |
| `/api/contact` | POST | No | Contact form submission. Rate-limited 5/hr. |
| `/api/chat` | POST | No | AI chatbot (Groq LLM). Rate-limited 30/hr. |
| `/api/abandonment/capture` | POST | No | Capture abandoned booking step |
| `/api/abandonment/send` | POST | No (CRON_SECRET) | Send recovery emails |

### Analytics & GDPR
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/analytics/events` | POST | No | Track analytics events |
| `/api/analytics/funnel` | GET | No | Funnel analytics (booking, signup) |
| `/api/gdpr/export` | GET | No | Export user data (Article 20) |
| `/api/gdpr/consent` | GET, POST | No | Consent status / record choices |
| `/api/gdpr/deletion` | GET, POST | No (GET=ADMIN) | Request data deletion (Article 17) |

### Utilities
| Route | Methods | Auth | Description |
|-------|---------|------|-------------|
| `/api/push/subscribe` | POST, DELETE | Yes | Manage push notification subscriptions |
| `/api/documents` | POST | Yes | Upload encrypted document (max 10MB) |
| `/api/calendar` | GET | No | Generate .ics calendar file for booking |
| `/api/health` | GET | No | Health check (DB connectivity, version) |
| `/api/cron/rtw-expiry` | GET | No (CRON_SECRET) | RTW expiry background job |

---

## 4. Page Routes

### Public / Marketing
| Route | Description |
|-------|-------------|
| `/` | Landing page (hero, services, how-it-works, reviews, guarantees, CTA) |
| `/services` | Service offerings (Regular, Deep, Same Day, End of Tenancy, AirBnB) |
| `/services/[category]` | Individual service category booking page |
| `/cleaners` | Browse/filter available cleaners |
| `/cleaners/[id]` | Public cleaner profile |
| `/about` | Company info and mission |
| `/pricing` | Service pricing |
| `/faq` | FAQ |
| `/guarantees` | Satisfaction guarantee, escrow, insurance, refund policy |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |
| `/contact` | Contact form |
| `/login` | Login (redirects authenticated users by role) |
| `/signup` | Registration with role selection ("I need a cleaner" / "I'm a cleaner") |
| `/forgot-password` | Password reset |
| `/join` | Cleaner application wizard (7-step) |
| `/booking/guest` | Guest booking flow (no account required) |
| `/offline` | Offline fallback page |

### Customer (auth-required)
| Route | Description |
|-------|-------------|
| `/dashboard` | Customer dashboard (redirects cleaners→/cleaner, admins→/admin) |
| `/account` | Profile, saved addresses, password management |
| `/account/bookings` | View/manage bookings |
| `/account/messages` | Messaging with cleaners |
| `/account/preferences` | Account preferences |
| `/book/[id]` | Book a specific cleaner |
| `/messages` | Messaging interface |
| `/disputes` | File/manage disputes |
| `/notifications` | View notifications |

### Cleaner-Only
| Route | Description |
|-------|-------------|
| `/cleaner` | Cleaner dashboard (jobs, earnings, reviews, stats) |
| `/cleaner/jobs` | Job list with status filtering |
| `/cleaner/profile` | Edit profile (photo, bio, specialties, rates) |
| `/cleaner/pricing` | Manage hourly rates by service type |
| `/cleaner/earnings` | Earnings, tax info, expense logging |
| `/cleaner/reviews` | View/reply to reviews |
| `/cleaner/availability` | Weekly schedule and availability toggle |
| `/cleaner/complete-profile` | Post-signup profile completion |
| `/cleaner/preview` | Preview public profile |
| `/verify` | Identity and right-to-work verification flow |

### Admin-Only
| Route | Description |
|-------|-------------|
| `/admin` | Admin dashboard (bookings, cleaners, revenue, disputes) |
| `/admin/customers` | Manage customer accounts |
| `/admin/cleaners` | Manage cleaner accounts and verification |
| `/admin/bookings` | View/manage all bookings |
| `/admin/disputes` | Resolve disputes |
| `/admin/settings` | Platform settings |
| `/admin/verification` | Cleaner verification and background checks |
| `/admin/dpia` | Data Protection Impact Assessments |
| `/admin/pricing` | Platform pricing and commission |
| `/admin/analytics` | Funnel analytics |

### Company Portal (auth-required, company member)
| Route | Description |
|-------|-------------|
| `/company` | Company portal homepage |
| `/company/team` | Team management |
| `/company/bookings` | Company bookings |
| `/company/analytics` | Company analytics |
| `/company/settings` | Company settings |

---

## 5. Customer Concept

### How customers exist today

There is **no separate Customer model or CustomerProfile table**. Customers are represented entirely by the **User model with `role = CLIENT`**.

| Concept | Implementation |
|---------|---------------|
| **Role** | `Role` enum value `CLIENT` — the default when a User is created |
| **Profile data** | Stored directly on the User model (name, email, phone, image) |
| **Addresses** | Separate `Address` model linked via `userId` — customers can have multiple |
| **Bookings** | `Booking.clientId` references User.id. Relation name: `bookingsAsClient` |
| **Guest customers** | Booking model has `guestEmail`, `guestName`, `guestPhone`, `guestToken` fields for unauthenticated bookings — no User record created |
| **Reviews** | Customers create reviews via `Review.clientId` |
| **Messages** | User-to-user via Message model (senderId/receiverId) |
| **Disputes/Complaints** | Filed by User via `raisedById` / `filedById` |

### Key observations

1. **Polymorphic User model** — the same table serves CLIENT, CLEANER, and ADMIN. Only CLEANERs get an additional `CleanerProfile` record.
2. **No customer-specific profile** — there's no equivalent of CleanerProfile for customers (no preferences, cleaning history summary, loyalty tier, etc.).
3. **Guest booking gap** — guest customers exist only as fields on the Booking row. They have no User record, no address book, no review capability, no messaging.
4. **Signup flow** — `/signup` page shows role selector ("I need a cleaner" → creates User with `role: CLIENT`; "I'm a cleaner" → redirects to `/join`). The CLIENT signup creates a bare User with no profile completion step.
5. **Admin customers page** — `/admin/customers` queries `User where role='CLIENT'` and counts their `bookingsAsClient`.
6. **`isClient` boolean** — exposed by `useAuth()` hook for UI role checks.
