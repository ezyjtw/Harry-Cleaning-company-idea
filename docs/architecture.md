# Architecture Overview

This document describes the high-level architecture of the Rena Cleaning Network platform.

## System Diagram

```
┌─────────────────────────────────────────────────────────┐
│                       Client (Browser)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Next.js App │  │   Tailwind   │  │  React State │  │
│  │  (App Router)│  │     CSS      │  │  Management  │  │
│  └──────┬───────┘  └──────────────┘  └──────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │ HTTPS
┌─────────┼───────────────────────────────────────────────┐
│         ▼           Server (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  API Routes  │  │   NextAuth   │  │  Server      │  │
│  │  /api/*      │  │   Sessions   │  │  Components  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘  │
│         │                 │                             │
│  ┌──────▼─────────────────▼──────┐                     │
│  │       Service Layer           │                     │
│  │  (Pricing, Estimator, Trust)  │                     │
│  └──────┬────────────────────────┘                     │
│         │                                              │
│  ┌──────▼──────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Prisma    │  │    Stripe    │  │  Email       │  │
│  │   ORM       │  │   Payments   │  │  Service     │  │
│  └──────┬──────┘  └──────────────┘  └──────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────┐
│                  PostgreSQL Database                    │
│  ┌──────┐ ┌────────┐ ┌─────────┐ ┌─────────┐          │
│  │Users │ │Bookings│ │ Reviews │ │Payments │  ...      │
│  └──────┘ └────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────┘
```

## Frontend Architecture

### Next.js App Router

The application uses the Next.js 14 App Router with a mix of server and client components.

**Layout hierarchy:**
```
app/layout.tsx (root - includes Navbar, Footer, PWA registration)
├── page.tsx (homepage - server component)
├── services/page.tsx (service listing)
├── cleaners/page.tsx (cleaner search)
├── cleaners/[id]/page.tsx (cleaner profile)
├── book/[id]/page.tsx (booking flow - client component)
├── dashboard/page.tsx (user dashboard - client component)
└── ... (static content pages)
```

**Server vs Client Components:**
- Server components: Static pages (about, FAQ, pricing, terms, privacy), cleaner listings, service pages
- Client components: Booking flow, dashboard, login/signup forms, interactive UI (FAQ accordion, estimator)

### Component Structure

```
components/
├── ui/                    # Base design system
│   ├── Button.tsx         # Primary, secondary, danger, ghost variants
│   ├── Input.tsx          # Form input with labels and errors
│   ├── Card.tsx           # Content card container
│   ├── Modal.tsx          # Dialog overlay
│   ├── Spinner.tsx        # Loading indicator
│   ├── Skeleton.tsx       # Content loading placeholder
│   └── Badge.tsx          # Status and label badges
├── providers/
│   └── AuthProvider.tsx   # NextAuth session provider
├── Navbar.tsx             # Site navigation header
├── Footer.tsx             # Site footer
├── CleanerCard.tsx        # Cleaner listing card
├── StarRating.tsx         # Star rating display
├── CategoryRatingBar.tsx  # Detailed rating breakdown
├── CleaningEstimator.tsx  # Room-based price estimator
├── VerificationBadge.tsx  # Verified cleaner badge
├── AvailableNowBadge.tsx  # Real-time availability indicator
└── EscrowBanner.tsx       # Escrow payment info banner
```

## Backend Architecture

### API Routes

All API routes are in `src/app/api/` and follow RESTful conventions.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/auth/[...nextauth]` | `GET, POST` | Authentication (NextAuth) |
| `/api/cleaners` | `GET, POST` | List cleaners / register new cleaner |
| `/api/cleaners/[id]` | `GET` | Get individual cleaner details |
| `/api/bookings` | `POST` | Create a new booking |
| `/api/estimate` | `POST` | Calculate price estimate |

### Service Layer

Business logic is encapsulated in the `src/lib/` directory:

- **pricing.ts** — Platform fee calculation (10%), price breakdowns, total cost computation
- **estimator.ts** — Room-based duration estimation, service type recommendations
- **trust.ts** — Cleaner tier calculation, verification status, trust scoring
- **config.ts** — Application-wide configuration values
- **mock-data.ts** — Development mock data for cleaners and bookings

## Database Schema Overview

The database uses PostgreSQL via Prisma ORM. Key models:

### Core Models
- **User** — All platform users (customers, cleaners, admins) with role-based access
- **CleanerProfile** — Extended profile for cleaner users (rates, specialties, verification status, tier)
- **Address** — User addresses for service delivery
- **Booking** — Service bookings linking customers, cleaners, and addresses
- **Review** — Post-booking reviews with multi-category ratings
- **Payment** — Payment records linked to bookings with Stripe integration
- **Message** — In-app messaging between users
- **Notification** — System and booking notifications
- **Dispute** — Dispute records for booking issues

### Authentication Models (NextAuth)
- **Account** — OAuth provider accounts
- **Session** — Active user sessions
- **VerificationToken** — Email verification tokens

### Enums
- `Role`: CLIENT, CLEANER, ADMIN
- `CleanerTier`: STARTER, BRONZE, SILVER, GOLD, ELITE
- `BookingStatus`: PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
- `PaymentStatus`: PENDING, SUCCEEDED, FAILED, REFUNDED, PARTIALLY_REFUNDED
- `DisputeStatus`: OPEN, UNDER_REVIEW, RESOLVED, DISMISSED

## Authentication Flow

```
1. User visits /login or /signup
2. Credentials submitted to NextAuth endpoint
3. NextAuth validates credentials against database (bcrypt)
4. Session created and JWT token issued
5. AuthProvider wraps app with session context
6. Protected routes check session server-side
7. API routes validate session via getServerSession()
```

## Booking Flow

```
1. Customer browses cleaners (/cleaners)
2. Customer views cleaner profile (/cleaners/[id])
3. Customer clicks "Book" → navigates to /book/[id]
4. Customer fills booking form:
   - Service type (regular, deep, end-of-tenancy, etc.)
   - Date and time
   - Duration (manual or estimator-suggested)
   - Address
   - Special instructions
5. Price calculated via getPriceBreakdown()
6. Customer confirms → POST /api/bookings
7. First booking with cleaner: payment held in escrow
8. Cleaner receives notification
9. Cleaner confirms → status: CONFIRMED
10. Service completed → status: COMPLETED
11. Escrow released to cleaner
12. Customer leaves review
```

## Payment Flow

```
1. Customer confirms booking
2. Stripe PaymentIntent created
3. Customer charged (card, Apple Pay, or Google Pay)
4. First booking: funds held in escrow (Payment status: PENDING)
5. Service completed and confirmed
6. Platform fee (10%) deducted
7. Cleaner earnings transferred via Stripe Connect
8. Payment status: SUCCEEDED
```

**Refund scenarios:**
- Full refund: cancellation 48+ hours before, or satisfaction guarantee claim
- Partial refund: cancellation 24-48 hours before (50%)
- No refund: cancellation less than 24 hours before

## Notification System

Notifications are stored in the database and can be triggered by:

| Event | Recipient | Type |
|-------|-----------|------|
| New booking request | Cleaner | BOOKING_REQUEST |
| Booking confirmed | Customer | BOOKING_CONFIRMED |
| Booking cancelled | Both | BOOKING_CANCELLED |
| Booking completed | Both | BOOKING_COMPLETED |
| Payment received | Customer | PAYMENT_RECEIVED |
| Payment sent | Cleaner | PAYMENT_SENT |
| New message | Recipient | NEW_MESSAGE |
| New review | Cleaner | NEW_REVIEW |
| Dispute opened | Both | DISPUTE_OPENED |
| Dispute resolved | Both | DISPUTE_RESOLVED |
