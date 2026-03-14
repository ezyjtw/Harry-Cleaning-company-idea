# Rena Cleaning Network

A modern cleaning marketplace built with Next.js 14 that connects customers with trusted, vetted independent cleaners. Rena differentiates itself with a low 10% platform fee (vs. the industry standard 20-30%), transparent pricing, escrow payment protection, and a focus on cleaner welfare.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js
- **Payments:** Stripe (escrow-based)
- **Deployment:** Railway

## Features

### For Customers
- Browse and search cleaners by location, specialty, and availability
- View detailed cleaner profiles with verified reviews and ratings
- Smart cleaning estimator (room-by-room duration and price estimation)
- Multiple service types: Regular, One-Off, Deep Clean, End of Tenancy, Airbnb, Same-Day
- Instant booking with real-time availability
- Escrow payment protection for first bookings
- In-app messaging with cleaners
- Satisfaction guarantee with re-clean or refund options

### For Cleaners
- Set your own hourly rates and availability
- Keep 90% of earnings (only 10% platform fee)
- Tiered reputation system (Starter, Bronze, Silver, Gold, Elite)
- Verified badge after background checks
- "Available Now" feature for same-day bookings
- Customer review and rating system

### Platform
- Responsive design (mobile-first)
- Progressive Web App (PWA) support
- SEO-optimised with dynamic sitemap and metadata
- Dispute resolution system
- Admin dashboard
- Notification system

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

# Stripe
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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
├── docs/                    # Documentation
│   ├── api.md               # API endpoint documentation
│   ├── architecture.md      # System architecture overview
│   └── setup.md             # Developer setup guide
├── prisma/
│   └── schema.prisma        # Database schema
├── public/
│   ├── icons/               # PWA icons
│   ├── images/              # Static images
│   └── manifest.json        # PWA manifest
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   │   ├── auth/        # NextAuth endpoints
│   │   │   ├── bookings/    # Booking CRUD
│   │   │   ├── cleaners/    # Cleaner search and registration
│   │   │   └── estimate/    # Price estimation
│   │   ├── about/           # About page
│   │   ├── book/[id]/       # Booking flow
│   │   ├── cleaners/        # Cleaner listing and profiles
│   │   ├── dashboard/       # User dashboard
│   │   ├── faq/             # FAQ page
│   │   ├── guarantees/      # Service guarantees
│   │   ├── how-it-works/    # How it works page
│   │   ├── join/            # Cleaner registration
│   │   ├── pricing/         # Pricing page
│   │   ├── privacy/         # Privacy policy
│   │   ├── services/        # Service categories
│   │   ├── terms/           # Terms of service
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Homepage
│   ├── components/          # Reusable React components
│   │   ├── ui/              # Base UI components (Button, Input, Card, etc.)
│   │   └── providers/       # Context providers
│   └── lib/                 # Utilities and business logic
│       ├── auth/            # Authentication configuration
│       ├── db/              # Database client
│       ├── utils/           # Validation, security, helpers
│       ├── config.ts        # App configuration
│       ├── estimator.ts     # Cleaning duration estimator
│       ├── mock-data.ts     # Development mock data
│       ├── pricing.ts       # Pricing calculations
│       ├── trust.ts         # Trust and verification logic
│       └── types.ts         # TypeScript type definitions
├── jest.config.ts           # Jest configuration
├── jest.setup.ts            # Jest setup file
├── tailwind.config.ts       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma migrate dev` | Run database migrations |
| `npx prisma generate` | Regenerate Prisma client |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cleaners` | List/search cleaners |
| `POST` | `/api/cleaners` | Register a new cleaner |
| `GET` | `/api/cleaners/[id]` | Get cleaner by ID |
| `POST` | `/api/bookings` | Create a booking |
| `POST` | `/api/estimate` | Get price estimate |
| `*` | `/api/auth/[...nextauth]` | NextAuth authentication |

See [docs/api.md](docs/api.md) for full API documentation.

## Deployment

### Railway

1. Create a new project on [Railway](https://railway.app)
2. Add a PostgreSQL service
3. Connect your GitHub repository
4. Set environment variables in Railway dashboard
5. Railway will auto-detect Next.js and deploy

```bash
# Build command (auto-detected)
npm run build

# Start command (auto-detected)
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
