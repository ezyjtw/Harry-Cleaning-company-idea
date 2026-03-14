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

# -- Stripe (optional for local dev) --
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

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

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run linter |
| `npx prisma studio` | Database browser |
| `npx prisma migrate dev` | Run migrations |
| `npx prisma generate` | Generate Prisma client |
| `npx prisma migrate reset` | Reset database |
| `npx jest --watch` | Run tests in watch mode |
