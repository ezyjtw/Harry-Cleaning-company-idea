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
- Report text for James is dash-free.

## Injected-script verification law (binding — James-ruled after the piece-1 relapse)

Any change to code that travels as a string (the shells' `injectedJavaScript*`
template literals above all) is verified on the **delivered** string, never the
source text. Reading source text is not verification for anything that travels
as a string: a TSX template literal cooks escapes (`\/` becomes `/`), so the
file can read as valid JS while the device receives a syntax error — and a
syntax error in one block kills the WHOLE concatenated injection, including the
dressed observer, turning every reveal into the 6s long-stop (the R13→piece-1
slowness, both shells). tsc and eslint cannot see inside the string; rig drives
that inject file-extracted text bypass the cooking and pass falsely.

Every gate on an injected-script change must therefore include BOTH:

1. **Cooked-parse proof** — evaluate the actual template literal (cook it as
   the engine does), concatenate the blocks exactly as the shell does, and show
   `new Function(delivered)` parses clean.
2. **Dressed-arrival timing table** — the real pane load and reveal measurement
   (navigation → 'dressed') against the current baseline, same conditions,
   showing no added load cost.

A backslash inside any injected template literal is written doubled (`\\/`) or
avoided (RegExp constructor with string patterns); an escape sweep across both
shells' template literals rides the gate.

## Shell freeze (standing state, James-ruled)

The shells (`mobile/`, `mobile-customer/`) are frozen. **No shell OTA for any
reason without James's explicit word naming the piece.** The freeze re-closes
behind every publish. Where the shells rest: **Pro** = R12-era baseline + tamed
PTR + loader clipping + Stripe escape net + O2/O3 + the three-witness lie check
plus Track 1 session lifecycle; **customer** = pre-R13 R8b baseline + tamed PTR
plus O2/O3 + lie check + Track 1. The lie check stays: harmless, correct, and the
net that would catch the stale-socket family if it ever appears for real.
Server-side fixes that reach installed binaries on deploy are always preferred
to an OTA when they can do the job (the Home-after-login bridge fix was one).

## Bench doctrine (binding)

Nothing is rated harmless by reading it. A change is innocent only when the
bench says so: a real measurement on the rig (or the device) against the
current baseline, same conditions, before and after. The burden sits on the
change to prove innocence, never on the symptom to prove guilt. Two relapses
wrote this: a template literal that read as valid JS and cooked into a syntax
error (the piece-1 slowness), and a redirect that worked on every rig because
the rig's host happened to BE the server's own address (the Home-after-login
bridge: `request.url` behind Railway resolves to `localhost:<port>`, so a rig
addressed as localhost passed falsely for three months). So the bench must
break the coincidences the rig shares with the server: spoof the public `Host`
header, point the advertised host at a dead address, cook the string, read the
edge log for the request that never arrived. A rig that cannot fail is not a
bench. Relative Locations for route-handler redirects; middleware redirects are
relativised by Next itself and must stay absolute (a hand-built relative
Location in middleware throws in Next's sandbox).

## Remediation register (binding)

`docs/REMEDIATION_REGISTER.md` is the authoritative list of audit findings,
their agreed mechanism, fix, tests, decisions and status. Every batch starts by
re-reading the register entries it touches and the current source, and ends by
updating those entries with the commit, changed files, tests and any deviation
from the agreed design. No batch widens its scope beyond its entries without
James's word. An item is DONE only when its acceptance criteria pass; a merge
is not DONE. If current source disproves an entry, report file and line
evidence and propose the register change; never build a workaround for a
finding that no longer exists. Batches run one at a time, each on James's word.

## Engineering laws from the register (binding)

- Server and database state are authoritative for pricing, permissions,
  booking lifecycle and money. The client never decides any of them.
- No business rule changes silently. A rule change is named in the gate
  report and ruled by James.
- No secret values, customer personal data, tokens, addresses, message
  bodies, key-access notes or payment data in logs, tests or fixtures. Logs
  carry internal ids; where correlation is essential, a keyed HMAC of the
  identifier. Real people named as sweep-exempt in session rulings are never
  used in fixtures.
- Nothing in a session writes to the production database or to live Stripe.
  Stripe work runs in test mode against fixtures. Deploys, OTAs, production
  migrations and Railway, Stripe or store settings change only on James's
  explicit word.
- A concurrency or invariant fix ships with a concurrency test against the
  rig Postgres, not a unit test alone.
- A money-state fix ships with idempotency and an unknown-outcome path.
- A trust decision on a URL (attaching a credential, allowing a navigation,
  forwarding a deep link) is made on a parsed URL with an exact host match,
  top frame only. Never string containment.
- A 401 or 403 is not a network error and an API failure is never shown as
  an empty state. Each gets its own state and its own door.
- No arbitrary delay is added to cure an app or WebView timing problem.
  Timing changes are measured on the bench first.
- React Native New Architecture is not disabled as a shortcut.
- No mass upgrade of Expo or React Native and no `npm audit fix --force`.
  Dependency moves are deliberate, patch-level inside the SDK, and ride a
  native rebuild bundle.
- Every completed item carries tests, or an explicit manual verification
  where automation is not honest.

## Hash law (binding)

All 26 baselined public routes are protected. Every sanctioned change names the
affected routes before implementation, gets an incognito diff, and re-baselines
those hashes in the same approved gate. Any unrelated public-route hash change
stops the batch.

The canonical list is `docs/public-routes.json`; the copy below must match it
exactly (a unit test fails otherwise), and the hash tool
(`scripts/public-route-hashes.ts`) and CI (`e2e/public-routes.spec.ts`) read the
same file:

<!-- public-routes:start -->

- `/`
- `/about`
- `/account-deletion`
- `/cleaners`
- `/cleaning`
- `/cleaning/chingford`
- `/contact`
- `/faq`
- `/forgot-password`
- `/guarantees`
- `/how-it-works`
- `/job-check`
- `/join`
- `/login`
- `/offline`
- `/pricing`
- `/privacy`
- `/regular-clean`
- `/services`
- `/services/regular`
- `/services/deep`
- `/services/end-of-tenancy`
- `/services/airbnb`
- `/signup`
- `/terms`
- `/unsubscribe`
<!-- public-routes:end -->

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

## EAS Update / OTA (binding)

Both shells (`mobile/` and `mobile-customer/`) have EAS Update configured:
`expo-updates`, `updates.url` to each app's EAS endpoint, channels
`preview`→`preview` and `production`→`production`. Every rule in this section
applies to both shells.
Pure shell-JS changes (App.tsx and its logic) ship OTA with `eas update
--channel production` instead of a TestFlight build. L2 `/app/*` pages are plain
web on Railway and update on deploy — they need neither a build nor an OTA.

- **Version-bump law (manual, do not forget).** `runtimeVersion` uses the
  **`appVersion`** policy — runtimeVersion IS `app.json` `version` (e.g.
  `1.0.0`). An OTA update only targets binaries whose runtimeVersion matches, so
  **before ANY native change** (new/upgraded native module or config plugin,
  permission, entitlement or Info.plist key, icon/splash, scheme or intent
  filter, google-services.json, notification configuration, bundle id,
  deployment target) you MUST bump `version` in the same change, and cut a
  fresh build for that version, before publishing OTA against it. Shipping shell JS that assumes a native
  change onto an older binary of the same version will crash it.
- **Why manual and not automatic:** the `fingerprint` policy (which detects
  native changes and gates OTA automatically) computed a different runtime
  version on the local machine than on the EAS builder and broke the Configure-
  expo-updates build phase, so it was replaced with `appVersion`. The safety
  fingerprint gave for free is now a discipline a human/session must hold.
- A native change with no version bump is a defect even if it builds. Every
  session touching either shell's native config re-reads this before shipping.

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
