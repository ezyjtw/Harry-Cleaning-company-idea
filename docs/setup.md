# Developer Setup Guide

This guide walks through setting up the Rena Cleaning Network for local development.

## Prerequisites

- **Node.js** 18.x or later ([download](https://nodejs.org/))
- **npm** (included with Node.js) or **yarn**
- **PostgreSQL** 14+ ([download](https://www.postgresql.org/download/)) or a hosted instance
- **Git** for version control

## 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/rena-cleaning-marketplace.git
cd rena-cleaning-marketplace

# Install dependencies
npm install
```

## 2. Environment Configuration

Create a `.env` file in the project root by copying the example:

```bash
cp .env.example .env
```

Then fill in the values:

```env
# -- Database --
# Local PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/rena?schema=public"

# -- NextAuth --
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-random-string-here"
# Generate with: openssl rand -base64 32

# -- Ryft (optional for local dev) --
RYFT_SECRET_KEY="..."
RYFT_PUBLIC_KEY="..."
RYFT_WEBHOOK_SECRET="..."

# -- App --
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Generating a NextAuth Secret

```bash
openssl rand -base64 32
```

Copy the output into `NEXTAUTH_SECRET`.

## 3. Database Setup

### Option A: Local PostgreSQL

1. Ensure PostgreSQL is running locally
2. Create the database:

```bash
createdb rena
```

3. Run migrations and generate the Prisma client:

```bash
# Generate the Prisma client
npx prisma generate

# Create database tables
npx prisma migrate dev --name init
```

### Option B: Hosted PostgreSQL (e.g., Railway, Supabase, Neon)

1. Create a PostgreSQL instance on your provider
2. Copy the connection string into `DATABASE_URL` in `.env`
3. Run:

```bash
npx prisma generate
npx prisma migrate deploy
```

### Exploring the Database

Use Prisma Studio for a visual database browser:

```bash
npx prisma studio
```

This opens a web UI at `http://localhost:5555`.

## 4. Running the Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Development Features

- **Hot Module Replacement (HMR):** Changes to components and pages reload instantly
- **API Routes:** Available at `http://localhost:3000/api/*`
- **Mock Data:** The app includes mock data in `src/lib/mock-data.ts` for development without a database

## 5. Running Tests

### Install Testing Dependencies

Testing dependencies need to be installed separately if not already present:

```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest ts-jest jest-environment-jsdom
```

### Run Tests

```bash
# Run all tests
npx jest

# Run tests in watch mode
npx jest --watch

# Run tests with coverage
npx jest --coverage

# Run a specific test file
npx jest src/__tests__/lib/pricing.test.ts
```

## 6. Linting

```bash
# Run ESLint
npm run lint
```

## 7. Building for Production

```bash
# Build the application
npm run build

# Start the production server
npm run start
```

## 8. Database Migrations

### Creating a new migration

After modifying `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name describe-your-change
```

### Resetting the database

To drop all data and re-run migrations:

```bash
npx prisma migrate reset
```

**Warning:** This deletes all data in the database.

## 9. Pre-commit Hooks

The project uses **Husky** and **lint-staged** to enforce code quality before every commit.

### Setup

Pre-commit hooks are installed automatically when you run `npm install`. If hooks are not running, initialise them manually:

```bash
npx husky install
```

### What Runs on Commit

lint-staged is configured to run the following on staged files:

- **TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`):** ESLint with auto-fix, then Prettier formatting
- **CSS files:** Prettier formatting
- **Prisma schema:** `prisma format`

```bash
# To manually run lint-staged (useful for debugging)
npx lint-staged
```

### Skipping Hooks (not recommended)

In rare cases where you need to bypass hooks:

```bash
git commit --no-verify -m "emergency fix"
```

## 10. Environment Validation

The application validates all required environment variables at startup. If any required variable is missing or malformed, the server will fail to start with a descriptive error message.

Validated variables include:

| Variable              | Required        | Validation                                   |
| --------------------- | --------------- | -------------------------------------------- |
| `DATABASE_URL`        | Yes             | Must be a valid PostgreSQL connection string |
| `NEXTAUTH_URL`        | Yes             | Must be a valid URL                          |
| `NEXTAUTH_SECRET`     | Yes             | Must be at least 32 characters               |
| `RYFT_SECRET_KEY`     | Production only | Ryft secret API key                          |
| `RYFT_PUBLIC_KEY`     | Production only | Ryft publishable key                         |
| `NEXT_PUBLIC_APP_URL` | Yes             | Must be a valid URL                          |

The validation logic is located in `src/lib/config/env-validation.ts`. To test your environment configuration without starting the server:

```bash
npx ts-node src/lib/config/env-validation.ts
```

## 11. Running Tests with Coverage

### Full Test Suite with Coverage Report

```bash
# Run all tests with coverage
npx jest --coverage

# Generate an HTML coverage report
npx jest --coverage --coverageReporters=html

# Open the report (macOS)
open coverage/index.html
```

### Coverage Thresholds

The project enforces minimum coverage thresholds configured in `jest.config.ts`:

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 70%       |
| Functions  | 75%       |
| Lines      | 80%       |
| Statements | 80%       |

If coverage drops below these thresholds, the test command will exit with a non-zero status.

### Running Specific Test Categories

```bash
# Unit tests only
npx jest --testPathPattern='__tests__/lib'

# Service layer tests
npx jest --testPathPattern='__tests__/services'

# API route tests
npx jest --testPathPattern='__tests__/api'
```

## 12. Infrastructure Setup Notes

### Memory Cache

The in-memory cache (`src/lib/infrastructure/cache.ts`) works out of the box with no external dependencies. Configuration options can be adjusted in `src/lib/config.ts`:

- **Default TTL:** 5 minutes
- **Max entries:** 1000
- **Eviction policy:** LRU (least recently used)

For production deployments with multiple instances, consider replacing the in-memory cache with Redis by implementing the same cache interface.

### Background Job Processor

The job processor (`src/lib/infrastructure/job-processor.ts`) runs in-process during development. Jobs are processed from an in-memory queue.

```bash
# Jobs are processed automatically when the server starts.
# To monitor queued jobs in development, check the structured logs:
npm run dev 2>&1 | grep "job-processor"
```

For production, configure an external job queue (e.g., BullMQ with Redis) by setting:

```env
REDIS_URL="redis://localhost:6379"
JOB_QUEUE_PROVIDER="redis"
```

### Error Monitoring

Error monitoring (`src/lib/infrastructure/error-monitoring.ts`) logs to the structured logger in development. For production, integrate with an external service by setting:

```env
ERROR_MONITORING_DSN="https://your-sentry-or-similar-dsn"
```

### Structured Logger

The logger (`src/lib/infrastructure/logger.ts`) outputs JSON-formatted logs. Control verbosity with:

```env
LOG_LEVEL="debug"   # Options: debug, info, warn, error
```

In development, logs are pretty-printed. In production (`NODE_ENV=production`), logs are compact JSON for log aggregation services.

## Common Issues

### "Cannot find module '@prisma/client'"

Run `npx prisma generate` to generate the Prisma client.

### "P1001: Can't reach database server"

- Ensure PostgreSQL is running
- Check the `DATABASE_URL` in `.env` is correct
- Verify the database exists (`createdb rena`)

### "NEXTAUTH_SECRET is not set"

Add a `NEXTAUTH_SECRET` value to your `.env` file. Generate one with:

```bash
openssl rand -base64 32
```

### Port 3000 already in use

Either stop the other process or use a different port:

```bash
npm run dev -- -p 3001
```

### Tailwind classes not applying

- Ensure `tailwind.config.ts` has the correct content paths
- Restart the dev server after modifying Tailwind config
- Check that `globals.css` includes the Tailwind directives

### Prisma schema changes not reflected

After changing `prisma/schema.prisma`:

1. Run `npx prisma migrate dev --name your-change`
2. Run `npx prisma generate`
3. Restart the dev server

### Build errors after pulling changes

```bash
npm install
npx prisma generate
```

## Useful Commands Reference

| Command                    | Description             |
| -------------------------- | ----------------------- |
| `npm run dev`              | Start dev server        |
| `npm run build`            | Production build        |
| `npm run start`            | Start production server |
| `npm run lint`             | Run linter              |
| `npx prisma studio`        | Database browser        |
| `npx prisma migrate dev`   | Run migrations          |
| `npx prisma generate`      | Generate Prisma client  |
| `npx prisma migrate reset` | Reset database          |
| `npx jest --watch`         | Run tests in watch mode |
