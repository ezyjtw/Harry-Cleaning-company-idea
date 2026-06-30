The default branch is main. Always target main for branches and pull requests.

## UAT after deployment

After every change that gets committed/pushed for deployment, provide a UAT
testing list. It must cover: (1) what changed / what is impacted, (2) which
user flows are affected and the exact steps to test them, and (3) what to look
out for error-wise (specific failure modes, status codes, log lines). Keep it
concrete and tied to the actual diff, not generic.

## Railway

Railway start command is configured via `railway.json`. The `--accept-data-loss` flag is required
because we use `prisma db push` rather than proper migrations. This is acceptable while there's no
real customer data; before launching to real users, migrate to `prisma migrate deploy` workflow.

## Reference data vs dev data

Two seed scripts exist:

- `prisma/seed-reference-data.ts` — idempotent upserts of reference data the
  app needs to function (ServiceType). Runs on every Railway deploy via the
  start command. Safe to re-run any number of times. The seed file is the
  source of truth — every deploy syncs DB values to match. Manual DB edits
  will be overwritten on next deploy.

- `prisma/seed.ts` — dev/test data (test users, test bookings, test cleaners)
  for local development. NEVER run automatically in production. Uses `create`
  (not `upsert`) so re-running locally requires resetting the DB first.

When adding new reference data the app depends on (e.g. a new service type,
a new fixed-price row), add it to `seed-reference-data.ts` using `upsert`.
Do not add to the dev seed.

The integrity check in `instrumentation.ts` verifies the reference seed
populated correctly. If it doesn't, the app refuses to boot and Railway
rolls back the deploy.

## Rate limiting

Three independent in-memory rate limiting layers exist:

- **Middleware global** (`src/middleware.ts`): 300 req/min per IP, applies to
  every request. Sized for normal authenticated browsing — single page loads
  can fire 10+ requests (page + CSRF + API calls + assets). Per-route limits
  below provide the security-sensitive enforcement.

- **Per-route via `checkRateLimit()`** (`src/lib/rate-limit.ts`): stricter
  limits on auth-sensitive endpoints — login 5/15min, signup 3/hour, password
  reset 3/15min, cleaner signup 3/hour, admin doc download 60/hour. These
  exist for security and should stay tight.

- **`RateLimiter` class** (`src/lib/utils/security.ts`): used by `/api/chat`
  (30/hour) and `/api/waitlist` (10/hour).

## Stripe Webhooks

Two webhook destinations are configured in the Stripe dashboard, each with its own signing secret:

- **`STRIPE_WEBHOOK_SECRET`** — Connected accounts destination. Receives `account.updated`,
  `account.application.deauthorized`. This is the scope for Connect account lifecycle events.

- **`STRIPE_WEBHOOK_SECRET_PLATFORM`** — Your account (Platform) destination. Receives
  `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.requires_action`,
  `payment_intent.canceled`, `charge.refunded`. This is the scope for payment events on direct
  charges made via the platform.

The webhook handler (`src/app/api/webhooks/stripe/route.ts`) tries both secrets in sequence.
The first successful `constructEvent()` wins. If neither secret verifies the signature, the
request is rejected with 400.

## Apple Pay

Apple Pay via Stripe requires a domain verification file at
`/.well-known/apple-developer-merchantid-domain-association`. After deploy, register the domain
in Stripe dashboard, get the file content, and place it in `public/.well-known/`.
