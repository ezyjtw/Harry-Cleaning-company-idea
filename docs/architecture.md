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
│  │   Prisma    │  │    Ryft      │  │  Email       │  │
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

| Route                     | Methods     | Purpose                              |
| ------------------------- | ----------- | ------------------------------------ |
| `/api/auth/[...nextauth]` | `GET, POST` | Authentication (NextAuth)            |
| `/api/cleaners`           | `GET, POST` | List cleaners / register new cleaner |
| `/api/cleaners/[id]`      | `GET`       | Get individual cleaner details       |
| `/api/bookings`           | `POST`      | Create a new booking                 |

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
- **Payment** — Payment records linked to bookings with Ryft integration
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
2. Ryft payment session created
3. Customer charged (card, Apple Pay, or Google Pay)
4. First booking: funds held in escrow (Payment status: PENDING)
5. Service completed and confirmed
6. Platform fee (10%) deducted
7. Cleaner earnings transferred via Ryft
8. Payment status: SUCCEEDED
```

**Refund scenarios:**

- Full refund: cancellation 48+ hours before, or satisfaction guarantee claim
- Partial refund: cancellation 24-48 hours before (50%)
- No refund: cancellation less than 24 hours before

## Notification System

Notifications are stored in the database and can be triggered by:

| Event               | Recipient | Type              |
| ------------------- | --------- | ----------------- |
| New booking request | Cleaner   | BOOKING_REQUEST   |
| Booking confirmed   | Customer  | BOOKING_CONFIRMED |
| Booking cancelled   | Both      | BOOKING_CANCELLED |
| Booking completed   | Both      | BOOKING_COMPLETED |
| Payment received    | Customer  | PAYMENT_RECEIVED  |
| Payment sent        | Cleaner   | PAYMENT_SENT      |
| New message         | Recipient | NEW_MESSAGE       |
| New review          | Cleaner   | NEW_REVIEW        |
| Dispute opened      | Both      | DISPUTE_OPENED    |
| Dispute resolved    | Both      | DISPUTE_RESOLVED  |

---

## Repository Layer

The platform uses the **Repository Pattern** to abstract data access from business logic. All database queries are encapsulated in dedicated repository classes located in `src/lib/repositories/`.

| Repository            | File                    | Responsibility                                                                                      |
| --------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- |
| **BookingRepository** | `booking.repository.ts` | CRUD operations for bookings, status transitions, filtering by customer/cleaner, date range queries |
| **UserRepository**    | `user.repository.ts`    | User lookup, creation, profile updates, role management                                             |
| **CleanerRepository** | `cleaner.repository.ts` | Cleaner profile queries, availability lookups, search with filters, tier updates                    |
| **ReviewRepository**  | `review.repository.ts`  | Review creation, aggregation (average ratings), per-cleaner and per-customer queries                |

Repositories are imported via `src/lib/repositories/index.ts` and injected into services, making it straightforward to swap data sources or add caching.

---

## Service Layer

Business logic is organised into focused services in `src/lib/services/`. Each service handles a single domain concern.

### Booking Services

| Service                      | File                            | Description                                                                                                                                         |
| ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BookingLifecycleService**  | `booking-lifecycle.service.ts`  | Manages the full booking state machine (PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED / CANCELLED). Enforces valid transitions and emits events. |
| **BookingValidationService** | `booking-validation.service.ts` | Validates booking requests (date/time constraints, cleaner availability, address completeness, duration limits).                                    |
| **CalendarLockService**      | `calendar-lock.service.ts`      | Prevents double-booking by locking calendar slots during the booking creation window.                                                               |
| **BookingReminderService**   | `booking-reminder.service.ts`   | Schedules and sends reminders to customers and cleaners before upcoming bookings (24h and 1h before).                                               |

### Pricing Services

| Service                 | File                       | Description                                                                                                               |
| ----------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **PricingService**      | `pricing.service.ts`       | Centralised pricing engine. Calculates totals including platform fee, extras, duration-based pricing, and discount codes. |
| **SurgePricingService** | `surge-pricing.service.ts` | Dynamic pricing multipliers based on demand, time of day, day of week, and availability scarcity.                         |

### Cleaner Services

| Service                     | File                           | Description                                                                                                                |
| --------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| **MatchingService**         | `matching.service.ts`          | Finds the best-fit cleaners for a booking based on location, specialties, ratings, availability, and customer preferences. |
| **AutoAssignmentService**   | `auto-assignment.service.ts`   | Automatically assigns a cleaner to a booking using the matching algorithm when no specific cleaner is selected.            |
| **CleanerProfileService**   | `cleaner-profile.service.ts`   | Manages cleaner profile data, bio, photos, specialties, and verification documents.                                        |
| **AvailabilityService**     | `availability.service.ts`      | Manages cleaner availability schedules, recurring patterns, and time-off blocks.                                           |
| **CleanerAnalyticsService** | `cleaner-analytics.service.ts` | Per-cleaner analytics: earnings over time, completion rates, average ratings, repeat customer rate.                        |
| **TravelTimeService**       | `travel-time.service.ts`       | Estimates travel time between jobs for scheduling optimisation.                                                            |

### Admin Services

| Service                      | File                            | Description                                                                                           |
| ---------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **AdminOperationsService**   | `admin-operations.service.ts`   | Admin actions: assign/reassign cleaners, suspend accounts, moderate reviews, override booking status. |
| **PlatformAnalyticsService** | `platform-analytics.service.ts` | Platform-wide analytics: revenue dashboards, cleaner utilisation, customer retention, booking trends. |

### Communication Services

| Service                         | File                               | Description                                                                                              |
| ------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **EnhancedMessagingService**    | `enhanced-messaging.service.ts`    | Rich messaging with conversation threads, read receipts, typing indicators, and message attachments.     |
| **EnhancedNotificationService** | `enhanced-notification.service.ts` | Multi-channel notifications (in-app, email, push) with user preference management and delivery tracking. |

### System Services

| Service             | File                   | Description                                                                                                                                           |
| ------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **AuditService**    | `audit.service.ts`     | Records all significant actions (booking changes, payment events, admin operations) with actor, timestamp, and before/after snapshots for compliance. |
| **JobQueueService** | `job-queue.service.ts` | Manages background job scheduling and execution. Supports delayed jobs, retries with exponential backoff, and priority queues.                        |

---

## Infrastructure Layer

Infrastructure concerns are isolated in `src/lib/infrastructure/` and provide cross-cutting capabilities.

### Memory Cache (`cache.ts`)

An in-memory cache with TTL (time-to-live) support for frequently accessed data such as cleaner profiles, pricing rules, and search results. Reduces database load and improves response times.

- Configurable TTL per cache key
- Automatic expiration and eviction
- Cache invalidation on write operations

### Background Job Processor (`job-processor.ts`)

Processes queued jobs asynchronously outside the request-response cycle. Used for:

- Sending booking reminders
- Processing payment webhooks
- Generating analytics reports
- Sending notification batches

Supports retry logic, dead-letter handling, and job prioritisation.

### Structured Logger (`logger.ts`)

A structured logging system that outputs JSON-formatted logs with consistent fields:

- Timestamp, log level, message, and context metadata
- Request ID correlation for tracing
- Environment-aware (verbose in development, compact in production)

### Error Monitoring (`error-monitoring.ts`)

Centralised error tracking and reporting:

- Captures unhandled exceptions and rejected promises
- Enriches errors with request context and user information
- Severity classification (info, warning, error, critical)
- Integrates with the structured logger for unified observability

---

## AI Agent System

The AI agent system lives in `src/lib/ai/` and provides intelligent automation for both customers and cleaners.

### Intent Parser (`intent-parser.ts`)

Natural language processing module that classifies user messages into actionable intents:

- Booking requests ("I need a cleaner next Tuesday")
- Schedule queries ("When is my next clean?")
- Pricing questions ("How much for a deep clean?")
- Complaints and feedback
- General enquiries

Extracts entities such as dates, times, service types, and locations from free-text input.

### Customer Assistant (`customer-assistant.ts`)

An AI-powered assistant for customers that can:

- Answer frequently asked questions about services and pricing
- Help find available cleaners matching preferences
- Guide through the booking process conversationally
- Provide booking status updates
- Handle rescheduling and cancellation requests

### Cleaner Assistant (`cleaner-assistant.ts`)

An AI assistant tailored for cleaners to help with:

- Schedule management and optimisation suggestions
- Earnings summaries and performance insights
- Responding to common customer questions
- Setting availability and managing time-off

### Scheduling Optimizer (`scheduling-optimizer.ts`)

Optimises cleaner schedules to maximise utilisation and minimise travel time:

- Considers geographic proximity between consecutive jobs
- Balances workload across available cleaners
- Suggests optimal time slots for new bookings
- Accounts for travel time, buffer periods, and cleaner preferences

### AI API Service (`ai-api.service.ts`)

The gateway layer for all AI interactions. Provides:

- Safety controls and content filtering on inputs and outputs
- Rate limiting per user for AI endpoints
- Response validation and fallback handling
- Prompt management and versioning
- Usage tracking and cost monitoring

---

## Security Architecture

Security is implemented across multiple layers in `src/lib/utils/` and `src/middleware.ts`.

### Role-Based Access Control (`rbac.ts`)

Fine-grained permission system built on three roles (CLIENT, CLEANER, ADMIN):

- Each role maps to a set of permissions (e.g., `booking:create`, `cleaner:manage`, `admin:moderate`)
- Middleware checks permissions before executing protected API routes
- Admin role inherits all permissions

### CSRF Protection (`csrf.ts`)

Cross-Site Request Forgery protection for all state-changing API requests:

- Token generation and validation per session
- Integrated with NextAuth session management
- Automatic token rotation

### Input Sanitization (`sanitize.ts`)

Sanitizes all user-provided input to prevent injection attacks:

- HTML/script tag stripping
- SQL injection prevention (supplementing Prisma's parameterised queries)
- Path traversal prevention

### API Validation (`api-validation.ts`)

Request validation middleware:

- Schema-based validation for all API request bodies
- Type coercion and default values
- Detailed validation error messages returned to clients

### Password Policy (`password-policy.ts`)

Enforces strong password requirements:

- Minimum length, uppercase, lowercase, numeric, and special character requirements
- Common password blocklist
- Password strength scoring

### Rate Limiting

Tiered rate limiting applied at the middleware level (see API documentation for specific limits per endpoint category).

### Audit Logging

All security-relevant events are logged via the AuditService, including:

- Authentication attempts (success and failure)
- Permission-denied events
- Admin operations
- Data access patterns for sensitive resources
