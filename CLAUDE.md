The default branch is main. Always target main for branches and pull requests.

## The gate workflow (binding)

Every piece of work follows: **build on a session branch → plain-text checklist
report → WAIT for James's explicit word → merge to main.** No merge on inference,
silence, or "looks done" — the word must be explicit.

- **Money-touching or data-deleting code** (payments, payouts, refunds, cascade,
  fees, anything that deletes or overwrites records): James gets a **full diff
  review** before the word, not just a checklist.
- **Visual changes**: before/after screenshots accompany the checklist.
- Checklists are plain text, per item, and state what changed, how to test it,
  and whether verifying needs a WEB-refresh or a TUNNEL-restart.
- **NO generated screenshots/images in gate reports by default** — they slow
  relays badly. House style is **screenshot-by-description** (text). Attach
  actual images ONLY when James explicitly asks for them on a specific item.
- Ambiguities are **parked with a note, never guessed**. The parked list ships
  with every gate report.

## App leak-proofing law (binding)

The native app effort may only touch: **`mobile/`**, **`/app` routes**, and
**shell-gated skins** of shared components. **Zero unconditional changes to
shared web pages.** Any change a shared page needs for the app must be gated on
the app shell (UA/shell detection), so the public site is untouched.

Acceptance test: **incognito diff** — a logged-out browser on the public site
must show identical behaviour and markup before/after the change. Every gate
report on app work includes the sweep: shared files touched → proof of the
shell gate → the incognito-diff statement.

## Three-layer app model

- **L1 — native shell**: the Expo app in `mobile/` (tabs, auth, push, haptics).
- **L2 — `/app` routes**: screens purpose-built for the shell, served into its
  WebView (e.g. `/app/jobs`, `/app/earnings`, `/app/inbox`).
- **L3 — wrapped portal**: existing portal pages rendered inside the shell,
  possibly with a shell-gated skin, until an L2 replacement earns its place.

## Settled rulings (James — do not relitigate)

- **Net-first earnings**: everywhere cleaner-facing, show net figures first.
- **6% service fee appears only at checkout** plus the pricing-example box —
  nowhere else on the site or app.
- **Cleaner-set rates** — no multipliers, anywhere.
- **Same-day cleaning = "coming soon"**, no price shown.
- **Light app theme**; **option-B logo untouched** (the lockup on light stays
  exactly as designed).
- **Brand fonts only**: Etna (logo), Newsreader (serif), Jost (sans). No
  system-font stand-ins on shipped surfaces.
- **Guest parity via tokened email links** — guests get the same flows through
  tokens, not accounts.
- **Catchment check fails open** — if the check errors, let the booking proceed.
- **"Rena Cleaning Network"** is the formal name; **"Rena"** is the brand.

## UAT after deployment

After every change that gets committed/pushed for deployment, provide a UAT
testing list. It must cover: (1) what changed / what is impacted, (2) which
user flows are affected and the exact steps to test them, and (3) what to look
out for error-wise (specific failure modes, status codes, log lines). Keep it
concrete and tied to the actual diff, not generic.

## Railway

Railway start command is configured via `railway.json` and runs `prisma migrate deploy` —
the migration workflow, cut over from `db push` pre-launch. The baseline is
`prisma/migrations/0_init` (the full launch schema, verified equal to what `db push` produced).

**Every schema change now requires a migration file.** After editing `schema.prisma`, generate
one with `npx prisma migrate dev --name <change>` locally (or `prisma migrate diff` + a new
`prisma/migrations/<timestamp>_<change>/migration.sql`), commit it alongside the schema change,
and it applies on deploy. `prisma db push` must not be used against prod — there is no
`--accept-data-loss` anywhere anymore, by design.

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

## Repo layout gotcha

Homepage section components (HowItWorks, ReviewsSection, HeroSection, StatsBar,
GuaranteeSection, ServicesSection, CleanerCTA, FooterCTA, …) live in the
root-level `components/` directory, NOT `src/components/`. Any dead-code, orphan
or unreferenced-asset sweep must search BOTH — a `src/`-scoped grep misses them
(this once nearly condemned the live how-step-1/how-step-3 homepage images).
