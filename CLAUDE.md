The default branch is main. Always target main for branches and pull requests.

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
## Apple Pay

Apple Pay via Stripe requires a domain verification file at
`/.well-known/apple-developer-merchantid-domain-association`. After deploy, register the domain
in Stripe dashboard, get the file content, and place it in `public/.well-known/`.
