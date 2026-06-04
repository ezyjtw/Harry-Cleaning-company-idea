# Rena Cleaning Network

A modern cleaning marketplace built with Next.js 14 that connects customers with trusted, vetted independent cleaners. Rena differentiates itself with a low 10% platform fee (vs. the industry standard 20-30%), transparent pricing, escrow payment protection, and a focus on cleaner welfare.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript 5.4
- **Styling:** Tailwind CSS 3.4
- **Database:** PostgreSQL with Prisma 5.14 ORM
- **Authentication:** NextAuth.js 4.24
- **Payments:** Ryft (escrow-based)
- **Email:** Resend
- **AI/NLP:** Groq LLM API, custom intent parser with entity extraction
- **Caching:** In-memory cache with TTL (Redis-ready interface)
- **Job Processing:** Background job queue with retry and backoff
- **Logging:** Structured JSON logger with request correlation
- **Code Quality:** Husky, lint-staged, ESLint, Prettier
- **Testing:** Jest 29.7, React Testing Library 15
- **Deployment:** Railway with Nixpacks

## Project Structure

```
├── src/                          # Main Next.js web application
├── prisma/                       # Database schema, migrations, and seeds
├── public/                       # Static assets and PWA icons
├── docs/                         # Documentation
└── .github/workflows/            # CI/CD
```

## Features

### For Customers

- Browse and search cleaners by location, specialty, and availability
- View detailed cleaner profiles with verified reviews and ratings
- Smart cleaning estimator (room-by-room duration and price estimation)
- Multiple service types: Regular, One-Off, Deep Clean, End of Tenancy, Airbnb, Same-Day
- Instant booking with real-time availability
- Full booking lifecycle management (pending, confirmed, in-progress, completed, cancelled)
- Automated booking reminders (24h and 1h before)
- Dynamic pricing engine with surge pricing during high-demand periods
- AI-powered cleaner matching based on location, specialties, ratings, and preferences
- Auto-assignment when no specific cleaner is selected
- Escrow payment protection for first bookings
- Rich in-app messaging with read receipts and conversation threads
- AI customer assistant for conversational booking and enquiries
- Satisfaction guarantee with full refund and help re-booking a cleaner

### For Cleaners

- Set your own hourly rates and availability
- Keep 90% of earnings (only 10% platform fee)
- Tiered reputation system (Starter, Bronze, Silver, Gold, Elite)
- Verified badge after DBS background checks
- "Available Now" feature for same-day bookings
- Calendar management with availability scheduling and time-off blocks
- AI cleaner assistant for schedule management and earnings insights
- AI-powered schedule optimisation to minimise travel time
- Per-cleaner analytics: earnings trends, completion rates, repeat customer rate
- Customer review and rating system

### Platform

- Responsive design (mobile-first)
- Progressive Web App (PWA) support
- SEO-optimised with dynamic sitemap and metadata
- Dispute resolution system with evidence upload
- Admin dashboard with assign, reassign, suspend, and moderation tools
- Platform analytics: revenue dashboards, cleaner utilisation, customer retention, booking trends
- Multi-channel notification system (in-app, email, push) with preference management
- Audit logging for compliance and traceability
- Background job processing for reminders, webhooks, and analytics
- Role-based access control (RBAC) with fine-grained permissions
- CSRF protection, input sanitisation, rate limiting, and password policy enforcement
- DBS verification and right-to-work checks
- GDPR data request handling
- Complaint management with severity classification
- Structured logging and error monitoring

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn
- PostgreSQL database (local or hosted)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/rena-cleaning-marketplace.git
cd rena-cleaning-marketplace

# Install dependencies
npm install
```

### Environment Setup

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rena?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Ryft Payments
RYFT_SECRET_KEY="..."
NEXT_PUBLIC_RYFT_PUBLIC_KEY="..."
RYFT_WEBHOOK_SECRET="..."

# Email
RESEND_API_KEY="..."

# AI
GROQ_API_KEY="..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_APP_NAME="Rena Cleaning Network"
```

### Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) Seed the database
npx prisma db seed
```

### Running Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                          # Next.js App Router pages and API routes
│   ├── api/                      # REST API (40+ route groups)
│   │   ├── admin/                # Admin operations (assign, reassign, compliance, pricing, rtw, documents)
│   │   ├── ai/                   # AI assistants and schedule optimisation
│   │   ├── analytics/            # Platform analytics
│   │   ├── auth/                 # NextAuth endpoints
│   │   ├── bookings/             # Booking CRUD and status transitions
│   │   ├── calendar/             # Calendar management
│   │   ├── chat/                 # Chat messaging
│   │   ├── cleaner/              # Cleaner profile, jobs, earnings, availability, reviews
│   │   ├── cleaners/             # Cleaner search and registration
│   │   ├── companies/            # Company management
│   │   ├── complaints/           # Complaint handling
│   │   ├── contact/              # Contact form
│   │   ├── documents/            # Document management
│   │   ├── estimate/             # Price estimation
│   │   ├── gdpr/                 # GDPR data requests
│   │   ├── health/               # Health check endpoint
│   │   ├── matching/             # Cleaner matching and auto-assignment
│   │   ├── messages/             # Conversations and messaging
│   │   ├── payments/             # Ryft payment processing and webhooks
│   │   ├── pricing/              # Pricing calculations and surge pricing
│   │   ├── verification/         # DBS and right-to-work verification
│   │   └── waitlist/             # Waitlist management
│   ├── about/                    # About page
│   ├── account/                  # Account management
│   ├── admin/                    # Admin dashboard (11 sections)
│   ├── book/[id]/                # Booking flow
│   ├── cleaner/                  # Cleaner details and reviews
│   ├── cleaners/                 # Cleaner listing
│   ├── dashboard/                # User dashboard
│   ├── disputes/                 # Dispute management
│   ├── faq/                      # FAQ page
│   ├── guarantees/               # Service guarantees
│   ├── how-it-works/             # How it works page
│   ├── join/                     # Cleaner registration
│   ├── messages/                 # Messaging UI
│   ├── pricing/                  # Pricing page
│   ├── privacy/                  # Privacy policy
│   ├── services/                 # Service categories
│   ├── terms/                    # Terms of service
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Homepage
│
├── components/                   # Reusable React components
│   ├── ui/                       # Base UI (Button, Input, Card, etc.)
│   ├── common/                   # Shared components
│   ├── layout/                   # Layout components
│   ├── providers/                # Context providers (auth, theme, notifications)
│   ├── AIChatWidget.tsx          # AI chat interface
│   ├── CleanerCard.tsx           # Cleaner listing card
│   ├── CleanerProfileModal.tsx   # Profile details modal
│   ├── CleaningEstimator.tsx     # Room/price estimator
│   ├── EscrowBanner.tsx          # Payment protection banner
│   ├── HeroQuoteWidget.tsx       # Homepage hero widget
│   └── Navbar.tsx                # Navigation bar
│
├── hooks/                        # Custom React hooks
│
├── lib/                          # Core business logic and utilities
│   ├── ai/                       # AI/LLM integrations
│   │   ├── intent-parser.ts      # NLP intent classification
│   │   ├── customer-assistant.ts # AI customer assistant
│   │   ├── cleaner-assistant.ts  # AI cleaner assistant
│   │   ├── scheduling-optimizer.ts # Route/schedule optimisation
│   │   └── ai-api.service.ts     # AI gateway with safety controls
│   ├── auth/                     # NextAuth configuration
│   ├── config/                   # App configuration and env validation
│   ├── db/                       # Database client initialisation
│   ├── infrastructure/           # Cross-cutting concerns
│   │   ├── cache.ts              # Memory cache with TTL
│   │   ├── job-processor.ts      # Background job processor
│   │   ├── logger.ts             # Structured JSON logger
│   │   └── error-monitoring.ts   # Error tracking and reporting
│   ├── repositories/             # Data access layer
│   │   ├── booking.repository.ts
│   │   ├── user.repository.ts
│   │   ├── cleaner.repository.ts
│   │   └── review.repository.ts
│   ├── services/                 # Business logic (40+ services)
│   │   ├── booking-lifecycle.service.ts     # Booking status transitions
│   │   ├── booking-validation.service.ts    # Booking validation rules
│   │   ├── booking-reminder.service.ts      # Automated reminders
│   │   ├── pricing.service.ts               # Pricing calculations
│   │   ├── surge-pricing.service.ts         # Dynamic surge pricing
│   │   ├── matching.service.ts              # Cleaner matching algorithm
│   │   ├── auto-assignment.service.ts       # Auto-assign logic
│   │   ├── availability.service.ts          # Availability checking
│   │   ├── calendar-lock.service.ts         # Calendar blocking
│   │   ├── cleaner-profile.service.ts       # Profile management
│   │   ├── cleaner-analytics.service.ts     # Cleaner stats
│   │   ├── travel-time.service.ts           # Travel time estimation
│   │   ├── platform-analytics.service.ts    # Platform-wide stats
│   │   ├── enhanced-messaging.service.ts    # In-app messaging
│   │   ├── enhanced-notification.service.ts # Multi-channel notifications
│   │   ├── audit.service.ts                 # Audit logging
│   │   ├── admin-operations.service.ts      # Admin tools
│   │   ├── dbs-verification.service.ts      # DBS background checks
│   │   ├── right-to-work.service.ts         # Work authorisation verification
│   │   ├── email.service.ts                 # Email sending (Resend)
│   │   ├── payment.service.ts               # Ryft payment processing
│   │   ├── document-storage.service.ts      # Document management
│   │   ├── gdpr.service.ts                  # GDPR data privacy
│   │   └── job-queue.service.ts             # Background job queue
│   ├── seo/                      # SEO utilities and sitemap generation
│   ├── utils/                    # Security and validation utilities
│   │   ├── rbac.ts               # Role-based access control
│   │   ├── csrf.ts               # CSRF protection
│   │   ├── sanitize.ts           # Input sanitisation
│   │   ├── api-validation.ts     # Request validation
│   │   └── password-policy.ts    # Password policy enforcement
│   ├── estimator.ts              # Cleaning duration estimator
│   ├── pricing.ts                # Pricing calculations
│   ├── trust.ts                  # Trust and verification logic
│   ├── catchment.ts              # Service area logic
│   ├── mock-data.ts              # Development mock data
│   └── types.ts                  # TypeScript type definitions
│
├── __tests__/                    # Test suites (api, components, lib)
│
└── middleware.ts                 # Next.js middleware (auth, validation)
```

## Available Scripts

| Command                 | Description                              |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Start development server with hot reload |
| `npm run build`         | Build for production                     |
| `npm run start`         | Start production server                  |
| `npm run lint`          | Run ESLint                               |
| `npm run lint:fix`      | Run ESLint with auto-fix                 |
| `npm run format`        | Run Prettier formatting                  |
| `npm run typecheck`     | Run TypeScript type checking             |
| `npm run test`          | Run test suite                           |
| `npm run test:coverage` | Run tests with coverage report           |
| `npm run test:watch`    | Run tests in watch mode                  |
| `npm run prepare`       | Install Husky pre-commit hooks           |
| `npm run db:generate`   | Regenerate Prisma client                 |
| `npm run db:migrate`    | Run database migrations                  |
| `npm run db:push`       | Push schema changes to database          |
| `npm run db:seed`       | Seed database with sample data           |
| `npx prisma studio`     | Open Prisma database GUI                 |

## API Endpoints

| Method        | Endpoint                                | Description                                     |
| ------------- | --------------------------------------- | ----------------------------------------------- |
| `GET`         | `/api/health`                           | Health check                                    |
| `*`           | `/api/auth/[...nextauth]`               | NextAuth authentication                         |
| **Bookings**  |                                         |                                                 |
| `GET/POST`    | `/api/bookings`                         | List/create bookings                            |
| `PATCH`       | `/api/bookings/[id]/status`             | Transition booking status                       |
| `POST`        | `/api/bookings/[id]/cancel`             | Cancel a booking                                |
| `POST`        | `/api/estimate`                         | Get price estimate                              |
| `POST`        | `/api/pricing/calculate`                | Full price calculation with surge and discounts |
| `GET`         | `/api/pricing/surge`                    | Get current surge pricing info                  |
| **Cleaners**  |                                         |                                                 |
| `GET`         | `/api/cleaners`                         | List/search cleaners                            |
| `POST`        | `/api/cleaners`                         | Register a new cleaner                          |
| `GET`         | `/api/cleaners/[id]`                    | Get cleaner by ID                               |
| `GET/PUT`     | `/api/cleaner/availability`             | Get/update cleaner availability                 |
| `GET`         | `/api/cleaner/jobs`                     | Cleaner's job list                              |
| `GET`         | `/api/cleaner/dashboard`                | Job stats and earnings                          |
| `GET`         | `/api/cleaner/earnings`                 | Earnings breakdown                              |
| `GET`         | `/api/cleaner/profile`                  | Profile management                              |
| `GET`         | `/api/cleaner/reviews`                  | Received reviews                                |
| **Matching**  |                                         |                                                 |
| `POST`        | `/api/matching/find`                    | Find matching cleaners                          |
| `POST`        | `/api/matching/auto-assign`             | Auto-assign best cleaner                        |
| **Messaging** |                                         |                                                 |
| `GET`         | `/api/messages/conversations`           | List conversations                              |
| `POST`        | `/api/messages/conversations/[id]/send` | Send a message                                  |
| **AI**        |                                         |                                                 |
| `POST`        | `/api/ai/customer-assistant`            | AI customer assistant                           |
| `POST`        | `/api/ai/cleaner-assistant`             | AI cleaner assistant                            |
| `POST`        | `/api/ai/schedule/optimize`             | AI schedule optimisation                        |
| **Admin**     |                                         |                                                 |
| `POST`        | `/api/admin/bookings/[id]/assign`       | Assign cleaner to booking                       |
| `POST`        | `/api/admin/bookings/[id]/reassign`     | Reassign cleaner                                |
| `POST`        | `/api/admin/pricing/config`             | Update pricing configuration                    |
| `POST`        | `/api/admin/compliance`                 | Compliance monitoring                           |
| `POST`        | `/api/admin/rtw`                        | Right-to-work management                        |
| `POST`        | `/api/admin/documents`                  | Document management                             |
| **Other**     |                                         |                                                 |
| `GET`         | `/api/analytics/overview`               | Platform analytics overview                     |
| `POST`        | `/api/verification/dbs`                 | DBS background check verification               |
| `POST`        | `/api/payments/webhook`                 | Ryft payment webhook                            |
| `POST`        | `/api/complaints`                       | File a complaint                                |
| `POST`        | `/api/gdpr/*`                           | GDPR data requests                              |
| `POST`        | `/api/companies`                        | Company management                              |
| `POST`        | `/api/contact`                          | Contact form                                    |
| `POST`        | `/api/waitlist`                         | Join waitlist                                   |

See [docs/api.md](docs/api.md) for full API documentation.

## Documentation

- [docs/api.md](docs/api.md) - Detailed API documentation
- [docs/architecture.md](docs/architecture.md) - System architecture overview
- [docs/setup.md](docs/setup.md) - Developer setup guide
- [docs/RENA_PRICING_SPEC_v3.md](docs/RENA_PRICING_SPEC_v3.md) - Comprehensive pricing specification

## Deployment

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL service
3. Connect your GitHub repository
4. Set environment variables in Railway dashboard
5. Railway will auto-detect Next.js and deploy

```bash
# Build command
npx prisma generate && npx prisma migrate deploy && npm run build

# Start command
npm run start
```

### Environment Variables for Production

Ensure all `.env` variables are configured in your deployment platform. Set `NEXT_PUBLIC_APP_URL` to your production domain.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

### Code Style

- Follow the existing code conventions
- Use TypeScript strict mode
- Write meaningful commit messages
- Add tests for new features where applicable
- Ensure `npm run lint` passes before submitting

## License

This project is proprietary. All rights reserved.
