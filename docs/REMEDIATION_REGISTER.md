# RENA REMEDIATION REGISTER

Authoritative list of the independent audit's findings, the agreed mechanism and fix for each, the tests that prove it, and its status. James-ruled, with the independent auditor's amendments adopted. Every batch starts by re-reading the entries it touches and the current source, and ends by updating those entries with the commit, changed files, tests and any deviation from the agreed design. See CLAUDE.md, section "Remediation register (binding)".

Source of truth at the time of writing: branch main at 766f98c. The two unmerged lanes referenced are claude/android-hardening (ac917eb lazy panes, e8076b3 splash) and the preview-channel instrumentation branch (3471da1).

## 1. Vocabulary

Status:

- CONFIRMED: source mechanism accepted as described.
- PARTIAL: the issue exists; wording, severity or mechanism was refined and the refined text below is the agreed one.
- RESOLVED: current source already fixes it; evidence and the regression test are recorded.
- CLOSED: challenged against source and found not to be a defect; evidence recorded, entry kept.
- DECISION: a product or security choice James has made or must make; the ruling and its date are recorded on the entry.
- EXTERNAL-VERIFY: needs a Railway, store, provider or legal check outside the source.
- HELD: built or standing by James's order, waiting on a named condition.

Proof type (what honestly proves the fix here):

- RIG-AUTO: a unit, integration or concurrency test runnable in CI or on the rig, including concurrency tests against the rig Postgres.
- RIG-PARTIAL + DEVICE: the rig proves the logic, a device walk proves the shell or OS half.
- DEVICE-ONLY: only a device or a store console can prove it.
- STRING-LAW: the change touches an injected template literal; the cooked-parse proof and the dressed-arrival timing table ride the gate (CLAUDE.md, injected-script law).
- HASH-LAW: the change touches one of the 21 baselined public pages; the hash law in CLAUDE.md applies.

Delivery:

- WEB: Railway deploy on merge to main.
- OTA: shell JS only, compatible with the installed runtimes (Pro 1.0.3, Rena 1.0.1) until the next binaries.
- REBUILD: native change, version bump, new binaries (Pro 1.0.4, Rena 1.0.2 and onward).
- EXTERNAL: provider, store or Railway configuration, performed by James.
- DOC: this register or CLAUDE.md only.

Every entry carries four tracking fields: Last verified commit (the commit the entry's evidence was checked against), Decision owner and date (who ruled and when, or "none needed"), Overlap group (section 4), Regression evidence (the test file or drive record that proves the fix, "none yet" until it exists).

## 2. Global engineering rules

These are the register's rules. The ones not already in CLAUDE.md are mirrored there under "Engineering laws from the register".

1. Read this file and the current source before each batch.
2. Do not broaden scope beyond the active batch without James's word.
3. Do not silently change business rules.
4. Server and database state remain authoritative for pricing, permissions, booking lifecycle and money.
5. No secret values, customer personal data, tokens, addresses, message bodies, key-access instructions or payment data in logs, tests or fixtures.
6. Stripe changes are developed and tested in test mode against fixtures; nothing in a session runs a destructive production mutation.
7. Database invariant and concurrency fixes need concurrency tests, not only unit tests.
8. Money-state fixes need idempotency and unknown-outcome handling.
9. WebView and native credential trust decisions use parsed URLs and exact origin rules, never string containment.
10. A 401 or 403 is not a network error and an API failure is never an empty state.
11. No arbitrary delay is added to cure an app or WebView timing problem.
12. React Native New Architecture is not disabled as a shortcut.
13. No mass upgrade of Expo or React Native dependencies and no npm audit fix --force.
14. Native dependency, config, plugin, permission, entitlement, splash, icon, scheme, intent-filter, google-services or notification changes require a new app version and fresh binaries, in both shells.
15. JS-only shell changes ship by OTA only when compatible with the currently installed native runtime.
16. Every completed item includes tests, or an explicit manual verification where automation is not honest.
17. A finding is not DONE until its acceptance criteria pass.
18. After each batch, update this register with commit, changed files, tests and any deviation from the agreed design.
19. No deploy, OTA, production migration, or change to live Railway, Stripe or store settings without James's explicit word.
20. If current source disproves a finding, return exact file and function evidence and propose the register change; never implement a workaround for a finding that no longer exists.

## 3. Decisions ruled by James (B0), 2026-10-06

- D-a. Add-on payout follows the parent service's commission rate: the cleaner keeps 90% on hourly cleans and 85% on End of Tenancy and Airbnb, unless a specific add-on defines its own split. Applies to RENA-073.
- D-b. The apps ask analytics consent once, on the first signed-in entry, with the same choice the website offers. Nothing analytics-related is sent before consent. Applies to RENA-059 and RENA-071.
- D-c. Biometric background re-lock (the JS half of RENA-041) is not adopted at launch. The cold-start lock stands as the control. Registered as optional hardening, revisited on user evidence.
- D-d. App links use role-owned paths: /open/customer/... for the customer app and /open/pro/... for Rena Pro, in their batch position (RENA-044).
- D-e. Scheduler: the Railway Bun Function is the executor and cron-job.org retires, in this exact order and no other: lease and heartbeat shipped and proven, then the external monitor set up and proven to alert on a deliberate stale test, then cron-job.org PAUSED (not deleted), then one week of clean single-tick ticks observed, then deleted. At no point is the scheduler unwatched. Applies to RENA-014, RENA-062, RENA-081.
- D-f. Lifecycle windows, server time in Europe/London from booking date plus start time and duration: EN_ROUTE allowed from two hours before scheduled start; IN_PROGRESS from thirty minutes before scheduled start; COMPLETED from thirty minutes before scheduled end; admin override through the audited override route. Applies to RENA-027 and RENA-032.
- D-g. Session design is one design, not three: a DeviceSession table keyed by a JTI for every bearer and every bridge-minted web session, a sessionVersion on User, and pwdAt on bridge-minted tokens. It is the heaviest gate in the programme: ceremonial drive plus James's walk of login, logout, account switch, password change and sign-out-everywhere on both apps and the web before merge. Applies to RENA-003, RENA-007, RENA-029 (server half), RENA-074.
- D-h. Enumeration (RENA-009): no change. Recorded as DECISION.
- D-i. Preview bypass (RENA-008): stays. Recorded as DECISION.
- D-j. Service worker: caches no /api/\* at all. Applies to RENA-048, RENA-055.
- D-k. Export: portability-export wording plus a separate SAR process. Applies to RENA-064.
- D-l. Logging: allowlisted structured logging, with a keyed HMAC of an identifier only where correlation is essential. Applies to RENA-066.
- D-m. Crypto-shredding: the claim is removed now; per-document data-encryption keys come later. Applies to RENA-067.
- D-n. RENA-074 is P1. RENA-076 is P2. RENA-075 is resolved by removing the misleading control.
- D-o. Freshness: explicit invalidation overrides coalescing. Applies to RENA-018, RENA-025.
- D-p. Navigation policy is top-frame only; Stripe frames are untouched. Applies to RENA-024, RENA-039, RENA-036.
- D-q. RENA-041 and RENA-045 carry proof type RIG-PARTIAL + DEVICE.

## 4. Overlap groups: one architectural change designed once

- A. Service-worker policy: 048, 055, 058. One sw.js (v6) that never touches /api/\*, caches static assets by extension, precaches the offline page, keeps the push handlers. WEB.
- B. Session design and session-lost contract: 003, 007, 019 (customer half), 029, 074, with 023's sign-in door and 020/021's auth-derived checkout mode. One design (D-g) with three edges: page (401/403 navigates to /login with callbackUrl; 5xx shows an error card with Retry; never an empty state), native (two consecutive 401s on the badges poll call logout; 403 and 5xx never do), server (DeviceSession, sessionVersion, pwdAt). WEB plus OTA both shells.
- C. Deep-link resolvers: 022, 037, 047, fed by 044. One resolver implemented identically in both shells' nav.ts, with the forward machinery ported to Pro and the cold-start notification response read. OTA both shells; 044 adds REBUILD.
- D. Navigation policy: 024, 039, 036. One classifier by parsed URL and exact host, top-frame only (D-p), with the statement Bearer rule and the Stripe exit rule as branches. OTA both shells.
- E. Lifecycle CAS, locks and windows: 012, 027, 028, 030, 032, 033. One assignment helper holding the per-cleaner advisory lock, expiry in the CAS, from-status in every transition WHERE, windows per D-f. WEB.
- F. Money ledger: 010, 011, 013, 015, 016, 017, 073, 075, 080. Normalised transfer-slice and refund-slice tables, booking refund state aggregated across original and top-up charges, a RESOLVING dispute state, shortfall hold, one stuck-money queue. WEB, full diff review per the gate workflow.
- G. Native rebuild bundles. N1 (Android first, Pro 1.0.4 and Rena 1.0.2): 040, 045, 060, 044 entitlements, 041 Android FLAG_SECURE, with 035's device matrix as the gate. N2 (iOS, same versions): the same set plus Universal Links; the iOS splash stays on the legacy storyboard by design. OTA lane (runtime 1.0.3 and 1.0.1): 038, 036 and D, C, B native half, 031, 046, 043.
- H. Scheduler: 014, 062, 081, with 063 and 065 riding the same scheduler and lease. WEB plus EXTERNAL per D-e.
- I. Checkout mode: 020, 021, with 023's sign-in door. WEB.
- J. Freshness: 018, 025. WEB.
- K. Logging and monitoring: 066, 068, 077, and the 004 closure. WEB.
- L. Governance: 042, 069, CLAUDE.md. WEB plus DOC.
- M. In-shell account handoff: 031, 082. One design for both shells: a successful in-shell application or signup completes the native handoff exactly as login does (native token minted, bridge redeemed, panes landing signed in). WEB plus OTA.

Design conflicts settled: (1) RENA-061's 503 against the deploy-time probe: safe, plus an external monitor; (2) D's "open external links in the browser" against Stripe 3DS issuer frames: the classifier acts on top-frame navigations only; (3) B's native logout on 401 against bridge replay during a restart: two consecutive 401s; (4) sessionVersion bumps on sign-out-everywhere against account switch on the same device: the switch revokes the leaving device's JTI only.

## 5. Batches

Order as adopted (the auditor's final order, James-ruled 2026-10-06). The order controls reviewability and dependencies; it is not permission to leave later findings unresolved. RENA-014 (lease and heartbeat) and RENA-061 (health 503) are pulled forward from B7 into B0 as foundations, with RENA-069 (CI) and RENA-068 (monitoring verification) alongside them per the approved B0 scope.

- B0 Governance, CI and decisions: the ruled decisions (section 3), CLAUDE.md and this register, CI on Node 22 with baseline unit and E2E checks, the runtime-bump check, scheduler lease and heartbeat, health 503, monitoring verification. CLOSED 2026-10-06 (James's word on each merge: 8f7e8f3, 6026a97, fd5f75f, 4b3d3b7, 66e891a). Every B0 item is DONE in code and proven in production; two James-side tails run on outside it: RENA-068's Sentry test event (EXTERNAL-VERIFY) and D-e steps four and five under RENA-081 in B7 (the seven-day single-caller watch, then cron-job.org deleted).
- B1 Authentication, sessions and privacy boundary: 001, 002, 003, 006, 007, 009, 059, 074, 066, 077, 079 (004 held and 008 decided sit here without batch work).
- B2 Service worker and customer recovery: 048, 055, 018, 019, 020, 021, 023, 025, 053, 054.
- B3 Cleaner lifecycle and concurrency: 012, 026, 027, 028, 030, 032, 033, 034.
- B4 Money ledger: 010, 011, 013, 015, 016, 017, 073, 075, 080.
- B5 Native shell OTA lane: 022, 024, 029, 031, 036, 037, 038, 039, 047, 082 (or B2 if its web half leads), and the JS halves of 041, 043, 046.
- B6 Web platform: 005, 049, 050, 051, 052, 057, 083, the controlled Next 15 move if required (056 and 058 closed).
- B7 Scheduler, operations and GDPR: 062, 063, 064, 065, 067, 070, 071, 072, 076, 081 (014, 061, 068, 069 delivered in B0).
- B8 Native rebuild: 040, 060, the native half of 041, 044, 045, then 035's device matrix as the release gate.
- B9 Full regression and register closure.

## 6. Execution protocol per batch

Before coding: re-read the batch's entries; search current source and report any entry that has changed since the last verified commit; return the files and functions to touch and the test plan; wait for James's word if the implementation deviates from the entry.

During coding: narrow commits on a session branch; tests alongside behaviour; never fix an error by hiding it or converting it into an empty or success state; preserve idempotency and retry behaviour around money and scheduled work; migrations ship with a forward migration, a backfill plan where needed and rollback notes.

After coding: run the batch's tests, root typecheck, lint and unit tests, the mobile checks for shell changes; provide the changed-files summary; report DONE, PARTIAL or BLOCKED per entry; update this register with the commit and the regression evidence only after success; do not begin the next batch.

## 7. Entries

Format per entry: title; severity, status, batch, overlap group; mechanism; fix; migration or config; tests; delivery and proof; the four tracking fields; implementation status.

### B0 Governance, CI and decisions

#### RENA-042 OTA compatibility depends on manual version discipline

Severity P2. Status PARTIAL. Batch B0. Overlap L.
Mechanism: both app.json use runtimeVersion policy appVersion; CLAUDE.md's version-bump law named only mobile/; nothing enforces it in CI.
Fix: CLAUDE.md names both shells and the full native-change set (done in the same change as this register); scripts/check-runtime-bump.mjs fails a PR that touches native-affecting paths in either shell without a version change in that shell's app.json; wired into CI by RENA-069. Policy stays appVersion.
Tests: the script against fixture diffs. Manual: none.
Delivery WEB plus DOC. Proof RIG-AUTO.
Last verified commit 6026a97. Decision owner and date: none needed. Overlap group L. Regression evidence: src/lib/ci/runtime-bump.test.ts (seven cases: OTA-safe extra change passes, plugin added without bump fails, same with bump passes, dependency change fails, icon or splash or plugin or google-services counts and fonts do not, key reordering is no change); CLI probe on a throwaway commit: splash plugin without bump fails naming the reason, with version 1.0.4 passes.
Implementation status: DONE for the guard and the CLAUDE.md law (commit a2a0207, merged 6026a97; CLAUDE.md in 8f7e8f3). The CI job runs on pull requests against main.

#### RENA-069 CI does not run the repository's tests and uses a different Node major from production

Severity P2. Status CONFIRMED. Batch B0 (pulled forward from B7 as a foundation). Overlap L.
Mechanism: .github/workflows/ci.yml runs npm ci, prisma generate, lint, tsc and build on Node 20 with placeholder env; no vitest, no Playwright, no mobile tsc; package.json engines is 22.x; no test:e2e script.
Fix: Node 22 in CI; vitest run; tsc for mobile/ and mobile-customer/; a Playwright smoke job against a Postgres service container seeded by the dev seed; the runtime-bump check (RENA-042) and the log-field check (RENA-066) once they exist.
Migration or config: workflow file and a test:e2e script only.
Tests: the workflow itself on a PR. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 6026a97. Decision owner and date: none needed. Overlap group L. Regression evidence: GitHub Actions run 37507767787 on 6026a97: web (lint, tsc, vitest, build), shell typecheck mobile, shell typecheck mobile-customer, E2E smoke (Playwright, 12 specs against the Postgres service) all green; version-bump job correctly skipped on push. @playwright/test 1.63.0 added; e2e/booking.spec.ts and e2e/home.spec.ts corrected to the live site (/services entry, menu-button navigation); e2e/health.spec.ts added.
Implementation status: DONE. Commit a2a0207 (branch claude/b0-ci-health), merged 6026a97, Railway deployment 8545a5b9 SUCCESS (the first build 17c36cd3 failed on the builder's Google Fonts fetch, see RENA-083; the redeploy of the same commit succeeded).

#### RENA-068 Web monitoring is low fidelity until production configuration is verified

Severity P2. Status CONFIRMED EXTERNAL-VERIFY. Batch B0 (pulled forward from B7 as a foundation). Overlap K.
Mechanism: server and edge Sentry init gated on SENTRY_DSN (src/instrumentation.ts:7-13), browser init on NEXT_PUBLIC_SENTRY_DSN (src/components/SentryInit.tsx:15-21), tracesSampleRate 0, no beforeSend, no source-map upload, no test-event script; whether either DSN is set in Railway is unknown from the repository.
Fix: James confirms both variables in Railway; beforeSend scrubbing lands with RENA-066; scripts/sentry-test-event.ts raises one server and one browser event on the rig against a test project; alert ownership set in Sentry. Native crash reporting is RENA-060.
Tests: the script. Manual: receipt confirmed in Sentry.
Delivery WEB plus EXTERNAL. Proof RIG-AUTO plus EXTERNAL-VERIFY.
Last verified commit 6026a97. Decision owner and date: none needed. Overlap group K. Regression evidence: Script refuses with exit 2 when no DSN is passed (proven on the rig); event receipt pending the James-side run.
Implementation status: Script DONE (scripts/sentry-test-event.ts, commit a2a0207, merged 6026a97). EXTERNAL-VERIFY pending: James confirms SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN in Railway and runs the script once against the rig with the DSN passed as an environment variable (never embedded in scripts or shell history), then raises the browser event per the script's instructions.

#### RENA-014 and RENA-062 Scheduler trigger outside the repository, doubled ticks, no liveness

Severity P1. Status CONFIRMED EXTERNAL DEPENDENCY. Batch B0 (lease and heartbeat, pulled forward from B7); the external steps stay in B7 under RENA-081. Overlap H.
Mechanism: nothing in the repository schedules /api/cron/run-jobs; no heartbeat model, no Sentry check-in, no scheduler status in /api/health. Railway's HTTP log shows every five-minute tick hit twice by two separate callers: cron-job.org and a Bun 1.3.0 client (the Railway Bun Function). Jobs are mostly compare-and-swap guarded, so the double tick doubles load and widens the money races rather than corrupting state.
Fix: a SchedulerRun table used as a lease (one row per tick minute, insert-as-claim; a second caller gets 200 with body skipped: lease held) and a heartbeat row (lastStartedAt, lastFinishedAt, lastSummary). The heartbeat is read by an external uptime monitor through a dedicated endpoint (/api/health/scheduler, 503 when the last finish is older than fifteen minutes), separate from /api/health's database 503 (RENA-061). Then the external steps in D-e, in that exact order.
Migration or config: one table. CRON_SECRET unchanged.
Tests: two concurrent POSTs, exactly one runs; a stale heartbeat yields 503; the summary line is written once per tick. Manual: the deliberate stale test for the monitor (James-side, D-e step two).
Delivery WEB plus EXTERNAL. Proof RIG-AUTO for the lease; EXTERNAL-VERIFY for the monitor and the trigger retirement.
Last verified commit 4b3d3b7 (HTTP log read 2026-10-06 15:35 to 16:05 UTC). Decision owner and date: James, 2026-10-06 (D-e). Overlap group H. Regression evidence: Production after deploy: first real run at 18:21:00 UTC; tick at 18:25 shows one summary (18:25:08) and one cadence skip (18:25:24, the second caller sixteen seconds later) while both triggers still fire; /api/health/scheduler answers 200 healthy with lastSucceededAt 18:25:08 and no failure. Unit: src/app/api/cron/run-jobs/route.test.ts (401 before the lease, run and release with summary, skip without running, error released and 500); src/app/api/health/scheduler/route.test.ts (200 healthy, 503 stale, 503 failing, 503 unreadable). Integration against Postgres (opt-in SCHEDULER_LEASE_INTEGRATION=1, wired into the CI e2e job): ten simultaneous claims give one winner; a claim after a finished run is refused on cadence and allowed after four minutes; a crashed run is refused as running and reclaimed once lockedUntil passes; repeated failures do not keep the heartbeat healthy, a later success restores it, an aged success reads stale; four passed on the rig. Live on the rig's production build: cron-job.org then Bun eight seconds later then a third gives one summary and two cadence skips; a crashed lock answers running then recovers; the heartbeat reads healthy after a success, failing with a newer failure, stale with an aged success and no newer failure; wrong secret 401.
Implementation status: DONE for the code half (D-e step one), RENA-062 with it as one item. Commit 4d9dd8d, merged fd5f75f, deployed b303fabb (main 4b3d3b7). Boot lines: 16 migrations found, 20261006180000_scheduler_lease applied, Ready in 320 ms. D-e steps two and three proven and executed on 2026-10-06 (evidence under RENA-081); steps four and five continue there.
Built shape (James-ruled amendment, 2026-10-06): the row carries lockedUntil, lastStartedAt, lastSucceededAt, lastFailedAt, lastCaller, lastSummary and a message-only lastError. A claim needs lockedUntil in the past AND lastStartedAt older than four minutes (cadence); on claim lockedUntil = now + 10 minutes and lastStartedAt = now; on finish lockedUntil = now. Only a successful run advances lastSucceededAt. /api/health/scheduler is 200 only while lastSucceededAt is within fifteen minutes; the body reports healthy, stale or failing with the three timestamps and never job internals or error text. The per-minute key first proposed was dropped because the two production callers straddle minute boundaries (16:00:31 and 16:01:01 in the HTTP log), and a release-clears-the-lock draft was dropped because the rig showed a POST one second after a finished run running the sweeps again.

#### RENA-061 Railway health check reports 200 with the database down

Severity P1. Status CONFIRMED. Batch B0 (pulled forward from B7 as a foundation). Overlap H.
Mechanism: src/app/api/health/route.ts:18-29 runs SELECT 1, reports degraded in the body, always returns 200 by design comment. Railway's healthcheck is a deploy-cutover probe only (traffic switches when it returns 200 within healthcheckTimeout); it does not poll afterwards, so the 200 alerts nobody and a 503 cannot cause a restart loop post-deploy.
Fix: /api/health returns 503 with the same body when the database query fails; railway.json healthcheckTimeout stays 120 (prisma migrate deploy runs before next start, so the database is reachable at cutover). The scheduler heartbeat lives on its own endpoint (RENA-014), not in this probe. An external uptime monitor polls /api/health and /api/health/scheduler and alerts on non-200 (James-side).
Migration or config: none in the repository.
Tests: mocked query failure returns 503; success returns 200. Manual: the monitor's alert on a deliberate failure.
Delivery WEB plus EXTERNAL. Proof RIG-AUTO plus EXTERNAL-VERIFY.
Last verified commit 6026a97 (Railway docs read 2026-10-06). Decision owner and date: none needed. Overlap group H. Regression evidence: src/app/api/health/route.test.ts (200 connected, 503 disconnected); e2e/health.spec.ts (two calls carry different timestamps, no-store header); rig: live timestamps on every call, 503 with Postgres stopped, 200 on return; production after deploy: two calls at 18:11:59 and 18:12:01 UTC, both 200 connected, cache-control no-store, no x-nextjs-cache header.
Implementation status: DONE. Commit a2a0207, merged 6026a97, deployed 8545a5b9.
Finding recorded during the batch: on main before this commit the route was prerendered into Next's static route cache (build output marked it static; production answered a frozen body with x-nextjs-cache HIT, timestamp fixed at the previous build's time and reading degraded because the Railway builder cannot reach Postgres). force-dynamic and revalidate 0 on the route are load-bearing; without them the 503 change would have failed every deploy cutover.

### B1 Authentication, sessions and privacy boundary

#### RENA-001 Web and auth dependency advisories

Severity P1. Status PARTIAL. Batch B1 (next-auth bump); the Next 15 move, if required, is B6. Overlap none.
Mechanism: next 14.2.35 carries the CVE-2025-29927 patch (absent from the audit output). Of the 23 GHSA advisories, the ones reaching our usage are the Server Components DoS family (GHSA-q4gf-8mx6-v5v3, GHSA-8h8q-6873-q5fj, GHSA-h25m-26qc-wcjf) and RSC cache poisoning (GHSA-wfc6-r584-vfw7); every patched version is 15.x. Not applicable by usage: Server Actions, rewrites, custom server, Pages Router i18n, WebSocket upgrades, CSP nonces, beforeInteractive scripts, Windows RCE, image remotePatterns. next-auth 4.24.13: the email-normaliser and OAuth advisories need providers we do not use; GHSA-xmf8-cvqr-rfgj (getToken throws on a malformed Bearer) applies because middleware calls getToken on every page request (src/middleware.ts:212).
Fix: bump next-auth to 4.24.15 now. Open a Next 15 migration lane after launch with its own gate (auth, middleware, booking, payment and WebView regression).
Migration or config: lockfile only for the bump.
Tests: a malformed Authorization header on a page request returns the page, not 500; the existing suite. Manual: login and shell login after the bump.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B1 for next-auth; B6 for Next 15 if required).

#### RENA-002 Rate limiting is process-local and proxy trust is deployment-dependent

Severity P1. Status PARTIAL. Batch B1. Overlap none.
Mechanism: three in-memory limiters (src/middleware.ts:40, src/lib/rate-limit.ts:11, src/lib/utils/security.ts:89) reset on restart; one Railway process today. The database-side account lockout (five failures, fifteen minutes; src/lib/auth/options.ts:9-10, 47-57) survives restarts and covers both login paths. With TRUSTED_PROXY unset the code trusts cf-connecting-ip first (rate-limit.ts:100, middleware.ts:35), a header anyone can send without Cloudflare in front.
Fix: James sets and confirms TRUSTED_PROXY=railway in Railway; a middleware test asserts the rightmost x-forwarded-for entry is used and a spoofed cf-connecting-ip is ignored in that mode; a shared store for the limiters is deferred until replicas exist.
Migration or config: one Railway variable.
Tests: spoofed-header cases through getClientIp in both modes. Manual: none.
Delivery EXTERNAL plus WEB (tests). Proof RIG-AUTO plus EXTERNAL-VERIFY.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B1).

#### RENA-003 Session-bridge single use is per process

Severity P2. Status CONFIRMED. Batch B1. Overlap B.
Mechanism: src/lib/auth/session.ts:54 holds consumed bridge JTIs in a module Map swept every sixty seconds; a 60-second signed JWT (64-70) can be consumed again after a restart or on a second instance; no table exists.
Fix: part of D-g. The consumed bridge JTI becomes a row (insert-as-claim; unique violation means replay) in the same session tables; a daily sweep deletes expired rows. The R8 self-heal (spent code plus existing cookie redirects) is unchanged.
Migration or config: covered by the D-g migration.
Tests: replay rejected with the Map cleared between calls; two concurrent consumptions against rig Postgres, one wins. Manual: shell login round trip both apps.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-g). Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B1, inside the session design gate).

#### RENA-006 CSRF helper unused on cookie-authenticated mutations

Severity P2. Status PARTIAL. Batch B1. Overlap none.
Mechanism: src/lib/utils/csrf.ts and src/lib/utils/rbac.ts have no importers. Protection is NextAuth's default cookie attributes (httpOnly, sameSite lax, secure in production) and the bridge-minted cookie's sameSite lax; no Origin, Referer or Sec-Fetch-Site check; no API CORS. SameSite lax keeps the session cookie off cross-site POSTs in current browsers; residual exposure is browsers without SameSite enforcement and same-site subdomains. Shells use a Bearer and are unaffected.
Fix: document the model in docs/architecture.md; in the middleware API branch, for non-GET requests carrying a session cookie, require Sec-Fetch-Site same-origin or none, or an Origin matching the canonical host; Bearer requests without a cookie pass; webhook routes (no cookie) pass. Delete csrf.ts and rbac.ts (RENA-079).
Migration or config: none.
Tests: foreign Origin plus cookie 403; same-origin plus cookie passes; Bearer without Origin passes; Stripe webhook passes. Manual: website booking, login, settings save; shell badges poll and statement download.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B1).

#### RENA-007 Mobile Bearer has no per-device revocation

Severity P2. Status PARTIAL. Batch B1. Overlap B.
Mechanism: src/lib/auth/session.ts:32-43 signs a 30-day JWT with no JTI and no version; verifyBearerToken (105-152) rejects DEACTIVATED, suspended and pre-password-change tokens on every call, so account-level revocation exists; device-level does not. shell-logout expires only the NextAuth cookie names and the shells call it without a Bearer.
Fix: D-g. DeviceSession rows (jti, userId, kind bearer or web, createdAt, lastSeenAt, revokedAt); the Bearer and the bridge-minted web token carry the jti and the user's sessionVersion; verification requires an unrevoked row and a matching version; shell-logout (now with the Bearer) revokes that device's row; "Sign out of all devices" in account settings bumps sessionVersion; password change and reset bump sessionVersion as well as passwordChangedAt; account switch revokes only the leaving device's row.
Migration or config: User.sessionVersion Int default 0; DeviceSession table; the bridge code table (RENA-003).
Tests: revoked jti is 401; version bump invalidates every live token; cookie session for the website unaffected; account switch leaves the other account's devices alive. Manual (the heaviest gate): ceremonial drive plus James's walk of login, logout, account switch, password change and sign-out-everywhere on both apps and the web before merge.
Delivery WEB plus OTA both shells (send the Bearer on logout). Proof RIG-AUTO plus the ruled walk (DEVICE).
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-g). Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B1, session design gate).

#### RENA-009 Account-state enumeration

Severity P3. Status DECISION (no change). Batch B1. Overlap none.
Evidence: the web NextAuth path is uniform; the shell JSON login distinguishes suspended and locked (src/lib/services/auth.service.ts:140-146); signup and check-email disclose existence by design and are rate limited; forgot-password and resend-verification use constant messages.
Delivery none.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-h). Overlap group none. Regression evidence: not applicable.
Implementation status: DECISION, no action.

#### RENA-059 First-party analytics sent regardless of consent

Severity P1. Status CONFIRMED. Batch B1. Overlap none.
Mechanism: consent is stored in localStorage and read only by the banner (src/components/CookieConsent.tsx:15-40, 53); src/lib/hooks/useAnalytics.ts sends every event and the unload beacon without consulting it (54-72, 87-115); the Decision-1 funnel fires on mount (src/app/[locale]/services/[category]/page.tsx:1399-1416); the server stores the IP (src/app/api/analytics/events/route.ts:70); the banner never renders in-shell (CookieConsent.tsx:100) while the hook still sends.
Fix: one consent gate (readConsent) that sendEvent, the beacon and the session-id write all consult; no analytics event, identifier or storage write before consent.analytics is true. In-shell per D-b: the apps ask once on the first signed-in entry with the same choice as the website; the answer is stored where the hook reads it. Server-side user linkage derived from the session, not the client.
Migration or config: none.
Tests: no consent means zero analytics requests in Playwright; Essential only means zero; accepted means events flow; in-shell UA before the first answer means zero. Manual: first signed-in entry on both apps shows the ask once.
Delivery WEB (the in-shell ask is an L2 or shell-gated web surface; no OTA). Proof RIG-AUTO. HASH-LAW on /services/[category] if the funnel hook changes there.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-b). Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B1).

#### RENA-074 Bridge-minted web sessions skip the password-change check

Severity P1. Status CONFIRMED. Batch B1. Overlap B.
Mechanism: src/app/api/auth/session-bridge/route.ts:155-165 encodes the NextAuth token without the pwdAt claim that the jwt callback sets (src/lib/auth/options.ts:99); getSessionUser's password-change check (src/lib/auth/session.ts:182-189) runs only when pwdAt is present, so a shell's web session survives a password change.
Fix: set pwdAt at the bridge mint; with D-g the sessionVersion check closes it a second way.
Migration or config: covered by D-g.
Tests: bridge-minted session is rejected after a password change; before the change it is accepted. Manual: part of the D-g walk.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-n, P1). Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B1, session design gate).

#### RENA-066 Production logs contain personal data and whole payloads

Severity P2. Status CONFIRMED. Batch B1. Overlap K.
Mechanism: src/lib/infrastructure/job-processor.ts:174 logs the whole email payload (address, name, subject, body); 169, 184, 199 log email or phone; 319 and 370 whole payloads; src/lib/services/email.service.ts:172 logs recipient and subject on every production send and 163-166, 181 on failure; its dev branch (118-130) also fires in production when Resend is unconfigured (RENA-077); src/lib/services/scheduler.service.ts:435-437 logs a cleaner's home postcode; src/lib/utils/errors.ts:57 logs the raw thrown value; Sentry has no beforeSend and error-monitoring.ts:108-117 forwards the whole context.
Fix: D-l. A structured logger (src/lib/log.ts) that accepts an allowlist of keys (ids, statuses, counts, durations, booking refs) and drops everything else; where correlation with an email or phone is essential (delivery failures), a keyed HMAC (LOG_HMAC_KEY) of the identifier; replace the lines above; Sentry init gains beforeSend that strips headers, cookies, query strings and extra payloads; a CI grep fails on console.log with payload, to:, email or phone in src/lib and src/app/api.
Migration or config: LOG_HMAC_KEY in Railway (EXTERNAL, one variable).
Tests: logger drops non-allowlisted keys; HMAC is stable and keyed; the CI grep. Manual: read one production send line after deploy.
Delivery WEB plus EXTERNAL. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-l). Overlap group K. Regression evidence: none yet.
Implementation status: TODO (B1).

#### RENA-077 Email service dev branch logs addresses and body in production when Resend is unconfigured

Severity P3. Status CONFIRMED. Batch B1. Overlap K.
Mechanism: src/lib/services/email.service.ts:118 guard is NODE_ENV not production OR no Resend client.
Fix: folded into RENA-066 (the branch logs through the allowlisted logger and never the body).
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group K. Regression evidence: none yet.
Implementation status: TODO (B1, with RENA-066).

#### RENA-079 Dead code: csrf.ts, rbac.ts, ui/Modal.tsx

Severity P3. Status CONFIRMED. Batch B1 (csrf.ts, rbac.ts); Modal.tsx in B6. Overlap none.
Mechanism: src/lib/utils/csrf.ts, src/lib/utils/rbac.ts and src/components/ui/Modal.tsx have no importers.
Fix: csrf.ts and rbac.ts removed in RENA-006; Modal.tsx becomes the dialog primitive in RENA-049/050.
Delivery WEB. Proof RIG-AUTO (tsc, lint).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO.

#### RENA-004 Temporary diagnostics endpoint on main

Severity P2. Status HELD (James-ordered). Batch B1 (no batch work: HELD). Overlap K.
Mechanism: src/app/api/shell/diag/route.ts: POST, no auth, 300 per minute per IP, 8 KiB body cap, console only, always 204; no caller on main; the beacons live in the Android preview bundles (3471da1) for the timing work.
Fix at closure, on James's word when the Android diagnostics close: delete the route; republish the preview channels from a bundle without PERF_JS and the beacon calls (STRING-LAW); record the closing commit here.
Delivery WEB plus preview OTA. Proof RIG-AUTO (route 404) plus the cooked-parse proof.
Last verified commit 766f98c. Decision owner and date: James (standing order, held). Overlap group K. Regression evidence: none yet.
Implementation status: HELD.

#### RENA-008 Shell preview bypass

Severity P3. Status DECISION (stays). Batch B1 (no batch work: DECISION). Overlap none.
Evidence: src/middleware.ts:162-203 sets rena-app-preview and rena-customer-preview on ?shell=1 (httpOnly false, sameSite lax, 30 days, no secure flag); src/app/[locale]/app/layout.tsx:19-26 is the only consumer and unlocks the chrome-free wrapper only; every /app data endpoint guards itself. Residual: the cookie lacks the secure flag; harmless given what it unlocks.
Delivery none.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-i). Overlap group none. Regression evidence: not applicable.
Implementation status: DECISION, no action.

### B2 Service worker and customer recovery

#### RENA-048 Service worker can cache authenticated API responses

Severity P1. Status PARTIAL (largely closed by 623be47). Batch B2. Overlap A.
Mechanism: public/sw.js:72-73 routes every /api/_ GET outside /api/auth and /api/disputes through networkFirst, which writes to Cache Storage unless the response says no-store or private (129-130). 623be47 set private, no-store in middleware for 17 prefixes (src/middleware.ts:101-102, 145) and purged the cache (v5). Still outside the family: /api/cleaners (personalised per viewer since acca3e7), /api/job-check, /api/analytics/funnel, /api/unsubscribe.
Fix: D-j. sw.js v6 never handles /api/_ (pure passthrough, no respondWith); static assets by extension; the offline page precached; push handlers kept; the activate handler purges v5. Middleware additionally sets private, no-store on /api/cleaners when a viewer is signed in.
Migration or config: none.
Tests: a vitest over the fetch handler with a fake cache (no /api/\* put ever); Playwright same-device account switch then offline cannot show the first account's data. Manual: one offline walk on the website.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c (partial closure 623be47). Decision owner and date: James, 2026-10-06 (D-j). Overlap group A. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-055 Service-worker strategy more complex than the launch requirement

Severity P2. Status CONFIRMED. Batch B2. Overlap A.
Mechanism: nothing in src reads cached API data or navigator.onLine; web push has no browser subscriber; the offline page is the only feature the SW serves; PWA install works from the manifest alone.
Fix: delivered by RENA-048's v6 rewrite.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-j). Overlap group A. Regression evidence: none yet.
Implementation status: TODO (B2, with RENA-048).

#### RENA-018 Post-payment return to a stale Home

Severity P1. Status PARTIAL (worse than described). Batch B2. Overlap J.
Mechanism: customer Home fetches once in a mount-only effect (src/app/[locale]/app/home/page.tsx:80-118); the confirmation page's Done is a bare Link to /app/home (src/app/[locale]/booking-confirmation/[id]/page.tsx:311-315) which the shell turns into a silent tab switch with no page load (mobile-customer/App.tsx:1327-1332, nav.ts:30-36). There is no 30-second coalescing on the customer side (R17 touched Pro only). Home shows what it fetched at boot until a pull-to-refresh reloads it.
Fix: D-o. An invalidation contract: a page registers window.\_\_renaRefresh and listens to visibilitychange and pageshow with a short coalescing window (15 s); explicit invalidation overrides coalescing: booking, payment, cancel, reschedule and top-up mutations write a stale marker (sessionStorage rena:stale with the surface names) that Home and My Cleans honour immediately on activation regardless of the window; stale-while-revalidate so the pane paints at once. The Done link carries ?paid=<id> so a forwarded load also works when the pane is not mounted (lazy panes).
Migration or config: none.
Tests: Playwright toggles visibility and asserts a refetch; a stale marker triggers an immediate refetch inside the window. Manual: pay, Done, Home shows the clean, on a device.
Delivery WEB. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-o). Overlap group J. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-019 Customer Home converts API and session failures into "no bookings"

Severity P1. Status PARTIAL. Batch B2. Overlap B.
Mechanism: home/page.tsx:82-83 maps every non-ok response to null, which becomes an empty list and the No Cleans card (88, 101, 247-249); no status read, no error state, no sign-in door; /app/book does the same (book/page.tsx:70-73); /app routes are not middleware-protected and the layout gate is shell-UA only. Pro Today distinguishes 401/403 and 5xx (today/page.tsx:672-679) but renders inline text instead of navigating (RENA-029).
Fix: Home and /app/book gain four states: loading, ready-empty, unauthorised (navigate to /login with callbackUrl, which the shell's watcher treats as session lost), error (card with Retry). Part of the B contract.
Migration or config: none.
Tests: Playwright with the API stubbed to 401, 403, 500 and a network failure shows the right state each time; empty data shows the No Cleans card. Manual: expired session in the customer app lands native login.
Delivery WEB. Proof RIG-AUTO (DEVICE for the native landing).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-020 Website "Sign in / Create account" option continues as guest

Severity P1. Status CONFIRMED. Batch B2. Overlap I.
Mechanism: src/app/[locale]/book/[id]/page.tsx:1097-1104 only sets bookingMode to account and enables the form; no navigation to /login or /signup; the server decides guest-ness by session (src/app/api/bookings/route.ts:800-810) so an unauthenticated account-mode booking is a guest booking with a minted token the client never puts in the return_url (src/components/booking/StripeCheckoutForm.tsx:64-67); the confirmation page then 401s and shows a dead end (booking-confirmation/[id]/page.tsx:86-89, 378-400).
Fix: checkout mode derives from the session: authenticated means account mode with no fork; unauthenticated shows the fork; "Sign in / Create account" navigates to /login with a callbackUrl back to the booking, with the booking state restored from sessionStorage (extend the existing rena-flow restore to book/[id]); guest stays guest; the return_url carries the token whenever the server minted one.
Migration or config: none.
Tests: Playwright: signed-in user never sees the fork; signed-out account choice lands on /login and returns with state; guest return_url contains gt; confirmation renders the booking in every mode. Manual: one test-mode payment in each mode on the website and in the customer shell.
Delivery WEB. Proof RIG-AUTO. Incognito diff rides the gate.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group I. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-021 Authenticated users still shown the fork

Severity P2. Status CONFIRMED. Batch B2. Overlap I.
Mechanism: book/[id]/page.tsx:1080 renders the fork on bookingMode === null only; isAuthenticated gates only convenience fetches; the customer shell sees the same fork.
Fix: delivered by RENA-020.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group I. Regression evidence: none yet.
Implementation status: TODO (B2, with RENA-020).

#### RENA-023 /pay/[id] error screen has no action

Severity P2. Status CONFIRMED. Batch B2. Overlap B.
Mechanism: src/app/[locale]/pay/[id]/page.tsx:47-56 renders the heading and the error text with no link or button; any non-ok becomes the generic text; the server returns 404 "Not found" for a logged-out or wrong user (pay-intent/route.ts:40-46), so a logged-out customer sees "Pay for your clean" over "Not found".
Fix: error card with Try again and Back to booking; on 404 with no session and no token, a Sign in door with callbackUrl to the same /pay URL.
Migration or config: none.
Tests: Playwright: logged-out shows the sign-in door; wrong user shows Not found with Back; network error shows Try again. Manual: recurring charge email link while logged out.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-025 Customer freshness relies on manual full reloads

Severity P3. Status CONFIRMED. Batch B2. Overlap J.
Mechanism: src/app/[locale]/account/bookings/page.tsx:479-560 fetches once at mount; no refresh registration under /account or /app/home; the shell PTR calls location.reload() when none is registered (mobile-customer/App.tsx:1096).
Fix: delivered by RENA-018's contract on Home and My Cleans.
Delivery WEB. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-o). Overlap group J. Regression evidence: none yet.
Implementation status: TODO (B2, with RENA-018).

#### RENA-053 Cleaners directory failure state

Severity P2. Status CONFIRMED. Batch B2. Overlap none.
Mechanism: src/app/[locale]/cleaners/CleanersDirectory.tsx:147-166: non-ok leaves state unchanged, a throw is swallowed; no error state; the zero-results copy doubles as the failure copy.
Fix: an error state with "Couldn't load cleaners" and Retry that preserves postcode and filters; zero results and invalid postcode keep their copy.
Migration or config: none.
Tests: Playwright with the API stubbed to 500 shows Retry; zero results shows the existing copy. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (/cleaners).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B2).

#### RENA-054 Form errors not announced to assistive technology

Severity P2. Status CONFIRMED. Batch B2. Overlap none.
Mechanism: three aria hits across the transactional forms (aria-invalid on the booking email input, role="alert" on the login and signup banners); none on the booking banner, the join wizard, checkout or the report sheet; no aria-describedby or aria-live.
Fix: one FieldError primitive rendering with an id; inputs reference it via aria-describedby and set aria-invalid; form banners get role="alert"; applied to booking, join, checkout, report sheet, login and signup.
Migration or config: none.
Tests: axe-core in Playwright on those pages. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (join, services).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B2).

### B3 Cleaner lifecycle and concurrency

#### RENA-012 Cleaner slot availability has a cross-booking race

Severity P1. Status CONFIRMED. Batch B3. Overlap E.
Mechanism: cascade.service.ts atomicAccept runs the slot check (488-494, three plain reads in slot-eligibility.ts:138-161) and the compare-and-swap (502-517) as separate statements with no transaction or lock; the swap asserts the booking's state only; no unique constraint on cleaner plus slot. Same shape in atomicProvisionalAccept and renaFindAccept. Customer-chosen cleaner bookings set cleanerId at creation (src/app/api/bookings/route.ts), a second assignment path.
Fix: one assignment helper used by every path that creates or replaces a cleaner assignment: a transaction that takes pg_advisory_xact_lock(hashtext(cleanerId)), re-reads overlap availability inside the transaction, then claims with the CAS (including RENA-030's expiry). A database exclusion constraint is later hardening.
Migration or config: none (advisory locks need no schema).
Tests: two simultaneous overlapping accepts against rig Postgres, exactly one wins; non-overlapping accepts both succeed; chosen-cleaner booking creation against a concurrent accept, one wins. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-026 Pre-accept offer payload exposes customer details

Severity P1. Status PARTIAL. Batch B3. Overlap none.
Mechanism: detail (cleaner/jobs/[id]/route.ts:143-144) ships clientName and clientEmail unconditionally while gating notes, full address and key access server-side (172-192); the list (cleaner/jobs/route.ts:169, 219) ships clientName and notes unconditionally. No phone, adminNotes or full address pre-accept. No internalNotes field exists.
Fix: one canonical serializer with the detail route's gate as the model: before assignment, first name only, no email, no notes, postcode only; after assignment, the current full set.
Migration or config: none.
Tests: list and detail for an AWAITING_CLEANER row contain no email, surname or notes; for an assigned row they do. Manual: the Offer screen on a device shows the postcode and first name.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-027 Completion allowed by date rather than scheduled time

Severity P1. Status CONFIRMED (documented design, superseded by D-f). Batch B3. Overlap E.
Mechanism: cleaner/jobs/[id]/route.ts:238-254 compares against the start of the booking day; at 00:01 a 14:00 job can be completed and the release clock starts.
Fix: D-f window helper: COMPLETED allowed from thirty minutes before scheduled end (start plus duration), computed in Europe/London from booking date plus startTime; admin override through the audited override-status route.
Migration or config: none.
Tests: boundary table including a BST transition day and a job crossing midnight. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-f). Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-028 Lifecycle updates vulnerable to a stale-read race

Severity P1. Status PARTIAL. Batch B3. Overlap E.
Mechanism: most transitions are guarded (accept, Rena-find accept, cleaner cancel rescue, customer cancel, admin cancel, reassign, rebroadcast, force-complete, dispute resolve). Unguarded: the cleaner PATCH for EN_ROUTE, IN_PROGRESS, COMPLETED and unpaid cancel (cleaner/jobs/[id]/route.ts:219-221, 382-388), the decline path's cascade advancement from a stale read (cascade.service.ts:239-300), admin manual assign (admin-operations.service.ts:45-47) and override-status (by design).
Fix: the cleaner PATCH becomes updateMany with the expected from-status in the WHERE and returns 409 with a refetch hint on zero rows; the decline path re-reads phase inside its CAS; manual assign goes through the assignment helper (RENA-012).
Migration or config: none.
Tests: complete racing a customer cancel, one wins; double-tap complete writes once; decline racing a sweep advances once. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-030 Offer expiry not enforced at accept

Severity P2. Status CONFIRMED. Batch B3. Overlap E.
Mechanism: none of the three accept paths selects or checks cascadeExpiresAt; only the five-minute sweep advances an expired phase, so an accept between expiry and the next tick passes.
Fix: cascadeExpiresAt greater than now (or null) in the CAS WHERE of all three paths; zero rows returns "This offer has expired"; same helper as RENA-012.
Migration or config: none.
Tests: accept after expiry refused; one second before expiry succeeds; sweep racing an accept yields one winner. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-032 Premature "On my way"

Severity P2. Status CONFIRMED. Batch B3. Overlap E.
Mechanism: cleaner/jobs/[id]/route.ts:351-352 sets arrivalConfirmed or checkedInAt with no time check; the customer is told "Cleaner on the way" (407-411).
Fix: D-f: EN_ROUTE from two hours before scheduled start, IN_PROGRESS from thirty minutes before; the same window helper; admin override.
Migration or config: none.
Tests: boundary table. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-f). Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-033 Cleaner lifecycle lacks end-to-end regression coverage

Severity P2. Status CONFIRMED. Batch B3. Overlap E.
Mechanism: e2e holds three logged-out smoke specs; no cleaner flow; no test:e2e script; CI runs no tests.
Fix: Playwright suites on the rig database for: verified cleaner happy path through release; backup offer acceptance and loser race; stale or expired offer rejection; cancellation racing a status update; premature EN_ROUTE and COMPLETED rejection; cleaner session invalidated inside the shell (rig half); Stripe onboarding incomplete and complete return; deletion blocked by a live job and a pending payout. Run in CI once RENA-069 lands.
Delivery WEB (tests). Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group E. Regression evidence: none yet.
Implementation status: TODO (B3).

#### RENA-034 Web cleaner portal has no deletion door

Severity P3. Status PARTIAL. Batch B3. Overlap none.
Mechanism: the Pro L2 room and the customer web door exist; the cleaner portal nav has no Settings or deletion entry; the global footer is suppressed in the portal; /account-deletion tells cleaners to use the app.
Fix: a "Delete my account" door at the bottom of the web cleaner Profile page opening the same type-to-confirm flow against /api/gdpr/deletion; /account-deletion mentions it.
Migration or config: none.
Tests: Playwright: the door renders; the POST is refused with blockers when a live job exists. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (/account-deletion).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B3).

### B4 Money ledger

#### RENA-010 Post-release refunds break when a payout used more than one Stripe transfer

Severity P1. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: transfer.service.ts joins transfer ids with a comma into Booking.stripeTransferId (191, 274-278) when the release is two slices (anchored plus excess on deep promo discounts, 151-160) or adopts several existing transfers (173-178); refund.service.ts:168 passes the raw string to stripe.transfers.createReversal (337). Stripe rejects the joined string, the reversal fails closed and the refund is refused.
Fix: a TransferSlice table (bookingId, stripeTransferId unique, amountPence, kind anchored or excess or adopted, createdAt); Booking.stripeTransferId kept as the first slice for display only during migration, then dropped; reversal iterates the slices proportionally with per-slice idempotency keys and records each reversal.
Migration or config: new table plus a backfill that splits existing comma-joined values; rollback notes.
Tests: split-transfer booking full and partial post-release refund reverses each slice; single-slice booking unchanged; backfill splits a joined value. Manual: none (Stripe mocked); one test-mode walk on the rig with a deep promo discount.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-011 Multi-charge refund partial failure overstates the ledger

Severity P1. Status PARTIAL. Batch B4. Overlap F.
Mechanism: on partial execution the booking is written honestly as PARTIALLY_REFUNDED (refund.service.ts:642-673) but the RefundRecord keeps amount = requested while becoming SUCCEEDED (657-667; writeRefundSuccess never rewrites amount), so alreadyRefunded (111) over-counts and the remainder retry is refused. The charge.refunded webhook judges full refund from the original charge alone (webhooks/stripe/route.ts:336-346), so a dashboard refund of the original charge on a booking with an unrefunded top-up flips the booking to REFUNDED.
Fix: a RefundSlice table (refundRecordId, stripePaymentIntentId, requestedPence, executedPence, stripeRefundId, status); RefundRecord carries requestedPence and executedPence; booking refund state is aggregated from executed slices across the original charge and every top-up; the webhook matches by payment intent and recomputes the aggregate against totalAmountCharged.
Migration or config: new table, two columns, backfill from the existing allocation JSON.
Tests: slice two fails after slice one, record shows executed less than requested, remainder retry succeeds; webhook on the original charge with an unrefunded top-up leaves PARTIALLY_REFUNDED; duplicate webhook is idempotent. Manual: none.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-013 Disputes marked RESOLVED before the money action is known

Severity P1. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: admin-operations.service.ts:630-652 commits dispute RESOLVED and the booking's terminal status before any Stripe call (documented status-first design, 566-569); money movement afterwards is best-effort and nothing reverts on failure; the route answers 200 with the failure only in refundStatus. Second defect: the dispute update inside the array transaction has no status guard, so a lost race (654-656) leaves the dispute RESOLVED with the booking untouched.
Fix: a RESOLVING dispute state written in the transaction (guarded on OPEN or UNDER_REVIEW for the dispute row and DISPUTED for the booking); money movement; then RESOLVED with resolvedAt only on confirmed refund or release, with the failure persisted and retried idempotently by the scheduler; final-resolution messaging sent at RESOLVED.
Migration or config: enum or string value RESOLVING; no new table.
Tests: refund fails after the transition, dispute stays RESOLVING and the retry resolves it; lost race leaves both rows untouched; happy path resolves. Manual: none.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-015 Stuck-money tooling does not cover every failure state

Severity P2. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: the queue lists RefundRecord REVERSAL_ONLY and UNKNOWN and TopupRecord UNKNOWN only, with no age filter and no transferStatus query; Retry exists for REVERSAL_ONLY only; never surfaced: RefundRecord FAILED and stale PENDING, TopupRecord FAILED, stale PENDING, DECLINED, EXPIRED, Booking.transferStatus UNKNOWN, FAILED, RELEASING, REFUNDING, PAUSED; the auto-release picks PENDING only; the reconciliation route queries a status COMPLETED never written (RENA-080).
Fix: one queue over every abnormal state with an age column and state-aware actions: UNKNOWN refund gets Reconcile with Stripe (refunds.list by payment intent, match metadata.refundRecordId, write the truth); FAILED refund gets Retry after an explicit Stripe query; stale PENDING over ten minutes is shown; transfer UNKNOWN, FAILED, RELEASING get the existing release button; PAUSED links the dispute; REFUNDING over ten minutes is shown; RENA-017's shortfall hold is shown.
Migration or config: none.
Tests: a rig fixture per state renders and each action works with Stripe mocked. Manual: one admin walk of the room.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-016 Payment-critical state machines lack regression coverage

Severity P2. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: six test files; none covers payment-success idempotency, duplicate webhook, cancel-versus-success, split transfer, multi-PI refund, unknown outcome, dispute or concurrent accept.
Fix: each money entry ships its tests; standalone cases for webhook dedupe and cancel-versus-success; Stripe mocked at the SDK boundary; concurrency against rig Postgres.
Delivery WEB (tests). Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-017 amount_received shortfall does not hold money

Severity P3. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: payment-success.service.ts:80-90 logs a shortfall and continues to the paid transition; PI mismatch and currency block.
Fix: keep the customer's confirmation; record amountShortfallPence on the booking, set transferStatus PAUSED so auto-release does not run, surface in the stuck-money queue, audit it; admin clears after checking Stripe.
Migration or config: one column.
Tests: shortfall pauses release and writes the field; equal amount does not. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-073 Add-on revenue has no cleaner share

Severity P2. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: pricing.service.ts adds addonTotal to the customer total (257-271, 346-360) and excludes it from cleanerPayout; transfer-amount.ts:1-9 says add-ons are not yet offered; services/[category]/page.tsx:145 claims the cleaner keeps 85% of add-on revenue.
Fix: D-a. Add-on payout follows the parent service's commission rate unless the add-on row defines its own split (ServiceAddon.cleanerSharePct nullable); cleanerPayout and the transfer amount include the add-on share; the stale comment is removed; the cleaner-facing breakdown shows it.
Migration or config: one nullable column on ServiceAddon.
Tests: hourly booking with an add-on pays 90% of the add-on; EOT with an add-on pays 85%; an add-on with its own split uses it; transfer amount matches. Manual: none.
Delivery WEB, full diff review. Proof RIG-AUTO. HASH-LAW if the services page copy changes.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-a). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-075 Admin pricing control drifts from the computation

Severity P3. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: PlatformConfig cleaner_fee_pct is seeded at 0.10 and shown on the admin pricing page, but pricing.service.ts hard-codes the rates (15-21); the display can drift from the computation.
Fix: D-n. Remove the misleading control: drop the cleaner_fee_pct row from the reference seed and the admin pricing display; the rates live in pricing.service.ts only, with the 10% and 15% stated on the admin page as read-only text sourced from the same constants.
Migration or config: seed change (idempotent upsert removal plus a one-off delete in the migration).
Tests: admin pricing page shows the constants; seed no longer writes the row. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-n). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-080 Reconciliation route queries a status never written

Severity P3. Status CONFIRMED. Batch B4. Overlap F.
Mechanism: admin/reconciliation/route.ts:97 queries RefundRecord status COMPLETED; the service writes SUCCEEDED.
Fix: folded into RENA-015.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4, with RENA-015).

### B5 Native shell OTA lane

#### RENA-022 Customer deep-link resolver cannot open nested routes

Severity P2. Status PARTIAL (real, dormant until customer push activates). Batch B5 (customer OTA, dormant until the customer push activation word). Overlap C.
Mechanism: mobile-customer/nav.ts:12-22 matches only the five tab roots; App.tsx:284-298 forwards only absolute URLs on BASE*URL with a query or hash; customer notification URLs are relative (/booking/<id>, /booking/<id>/approve-topup, /pay/<id>, /messages?bookingId=) and are bell rows; customer push is gated off (App.tsx:87). Through applyLink every one resolves to null or a bare switch.
Fix: the shared resolver (C): absolutise relative URLs against BASE_URL; map nested same-origin paths to an owning tab (/booking/* and /pay/\_ to mycleans, /messages* to messages, /cleaners/* to cleaners) and forward the full URL through externalNav; read the cold-start notification response once at boot.
Migration or config: none.
Tests: pure resolver table in nav.ts (RIG-AUTO). Manual: one tap per notification type once customer push is activated.
Delivery OTA (customer), in the same OTA as RENA-037. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group C. Regression evidence: none yet.
Implementation status: TODO (B5 OTA, dormant until the customer push activation word).

#### RENA-024 and RENA-039 Navigation policy, both shells

Severity P2. Status CONFIRMED. Batch B5. Overlap D.
Mechanism: mobile-customer/App.tsx:1457-1466 and mobile/App.tsx:1535-1572 intercept cross-tab roots (Pro also the statement and Stripe exit cases) and return true for everything else; no originWhitelist on pane WebViews; no Linking.openURL for http links, mailto or tel. Practical exposure today is small: the footer is hidden in-shell, chat bodies are plain text, the website field is never rendered; the dispute-evidence link and the calendar links are reachable in-pane.
Fix: D-p. classifyNavigation(url, state), identical in both shells, acting on top-frame navigations only (req.isTopFrame !== false): same-origin stays in-pane; the Stripe hosts stay in-pane during a payment or Connect flow; Stripe and issuer sub-frames are never touched; mailto and tel go to Linking.openURL; any other http(s) top-frame navigation opens in the system browser and returns false; unknown schemes return false. The statement rule (RENA-036) and the Stripe exit reroute are branches.
Migration or config: none.
Tests: classifier table (same origin, lookalike host, Stripe top frame, Stripe sub-frame, mailto, tel, javascript:, intent:). Manual: test-mode checkout with 3DS in the customer shell; Pro Connect round trip; the dispute evidence link opens the browser.
Delivery OTA both shells. Proof RIG-PARTIAL + DEVICE. STRING-LAW only if SEAM_KILL_JS is touched (not planned).
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-p). Overlap group D. Regression evidence: none yet.
Implementation status: TODO (B5).

#### RENA-029 No global session-lost contract for Rena Pro

Severity P1. Status CONFIRMED. Batch B5 (page and native halves); the server half rides B1. Overlap B.
Mechanism: the only native logout trigger is a WebView URL landing on /login or /api/auth/signin (mobile/App.tsx:1341-1343); the badges poll returns silently on any non-ok (1018); Today renders "Please sign in to see your jobs" inline on 401/403 (today/page.tsx:835-840); /app routes are not middleware-protected. A revoked or expired session leaves Pro stuck.
Fix: the B contract: every L2 page's 401 or 403 navigates to /login with callbackUrl (the shell watcher then logs out natively); 5xx and network show an error card with Retry; the badges poll logs out after two consecutive 401s (never on 403 or 5xx); the server half is D-g so revocation produces 401.
Migration or config: none beyond D-g.
Tests: rig: each L2 page with the API stubbed to 401 navigates to /login; 500 shows Retry. Manual: revoke a cleaner's session server-side, the app returns to native login within two poll ticks.
Delivery WEB plus Pro OTA. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-g for the server half). Overlap group B. Regression evidence: none yet.
Implementation status: TODO (B5; server half B1).

#### RENA-031 In-shell cleaner application lands in the website portal

Severity P2. Status CONFIRMED. Batch B5. Overlap none.
Mechanism: join/page.tsx:1533-1538 router.push('/cleaner') unconditionally after sign-in; mobile/App.tsx:929-946 JoinScreen is a full-screen WebView in the logged-out phase with no onSessionLost, onBridged or tab props, so onNav never reacts; no bridge message for join exists; the shell stays in phase join with the website dashboard inside it and no Bearer stored.
Fix: shell-gated branch on the join page: after the final submit navigate to /app/joined?email=...; JoinScreen gains onJoined(email); the shell switches to the login phase with the email prefilled and the line "Your application is in. Sign in to continue."; native login mints the Bearer and bridges to Today. Website behaviour unchanged.
Migration or config: none.
Tests: rig: in-shell UA join completes to /app/joined; website UA lands on /cleaner. Manual: the walk on a device.
Delivery WEB plus Pro OTA. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B5).

#### RENA-036 Rena Pro attaches its Bearer to a URL matched by substring

Severity P1. Status CONFIRMED. Batch B5. Overlap D.
Mechanism: mobile/App.tsx:1538 intercepts req.url.includes('/api/cleaner/statement') with no host check; fetchStatement (1386-1391) attaches the stored Bearer to whatever URL it is given; the iOS onFileDownload (1401-1407) hands any download URL from any origin to the same function. The only place either shell attaches the Bearer to a WebView-originated URL.
Fix: the D classifier: before reading the Bearer, parse the URL and require https, host equal to BASE_HOST and path equal to /api/cleaner/statement; the iOS and Android paths share the one validator; lookalike hosts and path confusion are rejected with the existing "Download failed" alert.
Migration or config: none.
Tests: validator table (same host, lookalike host, http, path prefix, userinfo trick). Manual: statement download on both platforms.
Delivery Pro OTA. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-p). Overlap group D. Regression evidence: none yet.
Implementation status: TODO (B5, same OTA as RENA-024/039).

#### RENA-082 Customer signup completed inside the Rena app leaves the shell broken

Severity P2. Status CONFIRMED (James-ruled addition). Batch B5 (customer shell OTA lane), or B2 if the web half leads. Overlap M.
Mechanism: the customer shell opens /en/signup in a dedicated SignupScreen WebView in the logged-out phase (mobile-customer/App.tsx:522, 892-909) with no onSessionLost, onBridged or tab props, so the shell's navigation watcher never reacts; the web signup page auto-signs the new account in and pushes /account (src/app/[locale]/signup/page.tsx:90-101), the website portal, inside that WebView. No native token is minted and the shell never enters the tabbed phase: the tab bar is absent, the user is forced to back out and log in again. Observed on device.
Expected: signup completes the native handoff exactly as login does (native token minted, bridge redeemed, panes landing signed in) and the customer lands on Home with the verify-email banner at the top.
Fix: designed together with RENA-031 as one handoff for both shells (overlap M). Shell-gated branch on the signup page: after a successful signup navigate to a shell-recognised completion URL carrying the email; SignupScreen gains an onSignedUp(email) prop; the shell performs the native login with the just-created credentials (or receives a one-time bridge code from the signup response, the mechanism to be reconciled against source in the batch), stores the Bearer, bridges to /app/home and shows the verify-email banner. Website behaviour unchanged (incognito diff).
Migration or config: none expected; a bridge-code return on the signup response is a server change if chosen.
Tests: rig: in-shell UA signup reaches the completion URL and the native login path; website UA lands on /account unchanged. Manual: the device walk, signup to Home with the banner, tab bar present. Proof RIG-PARTIAL + DEVICE.
Delivery WEB plus customer OTA.
Last verified commit 6026a97. Decision owner and date: James, 2026-10-06. Overlap group M. Regression evidence: none yet.
Implementation status: TODO (B5, designed with RENA-031; nothing built now).

#### RENA-037 Offer push cannot deep-link to the offer screen

Severity P1. Status CONFIRMED. Batch B5. Overlap C.
Mechanism: the server sends data.url /app/offer/<id> (enhanced-notification.service.ts:214); mobile/App.tsx:230-243 matches segments against the five tab keys only, returns null, and applyLink returns (360); nothing happens on tap; no cold-start response read.
Fix: the shared resolver (C): /app/offer/\* owns to the Today tab with the URL forwarded into the pane; Pro gains the forward machinery (overrideUri) the customer shell has; the cold-start notification response is read once at boot. Offers already surface on Today.
Migration or config: none.
Tests: resolver table (RIG-AUTO). Manual: tap the offer push in foreground, background and from terminated; an expired offer lands the Offer room's expired state.
Delivery Pro OTA. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group C. Regression evidence: none yet.
Implementation status: TODO (B5).

#### RENA-038 Both apps construct all five WebViews on login

Severity P2. Status HELD (built: ac917eb on claude/android-hardening). Batch B5. Overlap G (OTA lane).
Evidence: ac917eb touches only the two App.tsx files (JS-only); mountedPanes is a ref inside ShellScreen, which unmounts on logout; a customer forward into an unmounted pane loads the tab root first and then the forwarded URL (overrideUri effect after mount, mobile-customer/App.tsx:1296-1310).
Gate notes: measure the double load on the bench (dressed timing table, same conditions) and seed the initial uri with the forward when a pane is constructed by a forward (small addition to the same commit). Ships after the first instrumented walk, on James's word.
Delivery OTA both shells. Proof: bench timing table plus a device walk of cold deep links into each unmounted pane. STRING-LAW not applicable (injected scripts untouched).
Last verified commit ac917eb. Decision owner and date: James (ships after the first instrumented walk). Overlap group G. Regression evidence: none yet.
Implementation status: HELD.

#### RENA-047 Deep-link handling asymmetric between the apps

Severity P3. Status CONFIRMED. Batch B5. Overlap C.
Mechanism: the customer shell forwards https URLs with a payload through externalNav and overrideUri and falls back to tabRootKey; Pro only switches tabs and has no overrideUri; neither reads the cold-start notification response.
Fix: delivered by the C resolver implemented identically in both shells.
Delivery OTA both shells. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group C. Regression evidence: none yet.
Implementation status: TODO (B5).

#### RENA-043 App-to-app fallback store URLs are empty

Severity P2. Status CONFIRMED, EXTERNAL-VERIFY first. Batch B5 (JS half, once both listings are live). Overlap G (OTA lane).
Mechanism: mobile/app.json:60 customerStoreUrl "" and mobile-customer/app.json:63 proStoreUrl ""; the doors fall back to "on its way to the App Store" copy. The values are read from Constants.expoConfig.extra, which the EAS Update manifest carries, so filling them is OTA-eligible.
Fix: populate both with the live listing URLs, or a Rena redirect page (/get-app, resolves by platform) once both listings are live; test with the sibling app installed and not installed.
Migration or config: app.json extra values.
Tests: none. Manual: both doors on both platforms.
Delivery EXTERNAL then OTA; the redirect page is WEB. Proof DEVICE-ONLY.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group G. Regression evidence: none yet.
Implementation status: TODO (after both listings are live).

#### RENA-046 Notification permission prompt timing

Severity P3. Status PARTIAL. Batch B5. Overlap none.
Mechanism: mobile/App.tsx:531-533 calls registerPush on every entry to the shell phase; 505 prompts whenever not granted and canAskAgain; nothing stored on denial; the comment at 204-212 is stale. Customer shell gated off by PUSH_ACTIVATED.
Fix: a one-time rationale card before the OS prompt; an "asked" flag in SecureStore so the prompt is offered once per install and again only from a settings door; delete the stale comment.
Migration or config: none.
Tests: none practical. Manual: fresh install walk.
Delivery Pro OTA. Proof DEVICE-ONLY.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B5).

### B6 Web platform

#### RENA-005 Content-Security-Policy hardening (renamed from "no CSP")

Severity P2. Status PARTIAL. Batch B6 (report-only first, enforce after the fortnight). Overlap none.
Mechanism: a CSP exists at src/middleware.ts:273-291 on page responses: script-src carries 'unsafe-eval' and 'unsafe-inline', style-src 'unsafe-inline', no nonce, no report-only, no reporting endpoint. /api responses carry no CSP (fine for JSON).
Fix: step one, confirm on the rig that the production bundle and Stripe.js run without 'unsafe-eval' and drop it; step two, a Content-Security-Policy-Report-Only twin with a nonce-based script-src and a /api/csp-report endpoint, run for a fortnight after launch; step three, enforce. Stripe Elements, Sentry browser init and the postcode lookup stay in connect-src and frame-src.
Migration or config: none.
Tests: middleware header assertions; Playwright checkout on the rig with the stricter header (Elements mounts, 3DS iframe loads). Manual: one test-mode payment with the header enforced.
Delivery WEB. Proof RIG-AUTO. Incognito diff of the public pages rides the gate (headers served on them); HASH-LAW does not apply to headers.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6 steps one and two; step three after the report-only fortnight).

#### RENA-049 and RENA-050 Dialog accessibility, one primitive

Severity P2. Status CONFIRMED. Batch B6. Overlap none.
Mechanism: CleanerProfileModal.tsx has Escape but no role, aria-modal, labelling, focus trap or focus return; src/components/ui/Modal.tsx has role, aria-modal, Escape and initial focus but no Tab cycling or focus return and no consumer; AccountMenu, the customer account sheet, ReportSheet and ConversationInfoSheet carry role and aria-modal but no Escape, trap or return; WebcamCaptureModal has none.
Fix: finish ui/Modal.tsx into the single primitive (label, focus into, Tab and Shift+Tab trap, Escape where safe, inert background, focus return) and migrate the six components.
Migration or config: none.
Tests: axe plus a keyboard Playwright test (Tab cycles inside, Escape closes, focus returns). Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (/cleaners modal).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6).

#### RENA-051 Locale subtree forced dynamic

Severity P2. Status CONFIRMED. Batch B6. Overlap none.
Mechanism: src/app/[locale]/layout.tsx:6 force-dynamic, introduced by 058a939 with no comment; the layout reads no headers, cookies or session; only 'en' exists; the homepage, area pages and cleaners page declare revalidate under it, which the parent overrides.
Fix: remove the layout-level force-dynamic; each page declares its own mode; the 24 admin pages and any page reading headers or cookies keep force-dynamic; verify with the next build route table and production cache headers.
Migration or config: none.
Tests: a check that the build manifest marks the marketing routes static or ISR; Playwright incognito diff of the 21 pages. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (all 21 pages; every affected page named before implementation).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6).

#### RENA-052 Booking page size

Severity P2. Status CONFIRMED, deferred until measurement. Batch B6 (after the timing table). Overlap none.
Mechanism: services/[category]/page.tsx is 5,125 lines, 'use client', 54 useState and 21 useEffect, no dynamic imports; book/[id] 1,600; join 3,097.
Fix: none until the tap-to-dressed timing table from the instrumented walk is in; then split by step boundaries and lazy-load the payment step.
Delivery WEB. Proof: bench timing table. HASH-LAW (/services/\*).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: DEFERRED (B6).

#### RENA-057 Structured data coordinates

Severity P3. Status CONFIRMED. Batch B6. Overlap none.
Mechanism: src/lib/seo/structured-data.ts:72-76 hard-codes central London coordinates into the LocalBusiness schema rendered on the homepage with addressLocality "North-East London and Essex".
Fix: drop geo from the homepage LocalBusiness block (the registered office address stays), or use the area centroid the area pages already compute.
Migration or config: none.
Tests: the schema has no geo or has the centroid. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (homepage).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6).

#### RENA-083 Production build fetches Google Fonts at build time

Severity P3. Status CONFIRMED (James-ruled addition). Batch B6. Overlap none.
Mechanism: src/lib/fonts.ts loads Newsreader and Jost through next/font/google, which fetches fonts.googleapis.com during next build. A transient failure of that fetch fails the whole build: observed on the Gate A build of B0 (Railway deployment 17c36cd3, 2026-10-06 18:01 UTC, "An error occurred in next/font ... TypeError: Cannot read properties of null (reading '1')" in the Google loader) while the same commit built clean on GitHub Actions at the same minute and twice on the rig. The failed deploy left the previous deployment serving; the redeploy of the same commit is the recovery.
Fix: self-host the font files via next/font/local: the Newsreader (500, 600, normal and italic) and Jost (400, 500, 600) files committed under public/fonts or src/fonts with their OFL licence files, loaded with next/font/local with the same CSS variables, display swap and fallback chains, so the build carries no build-time network dependency. Etna stays as is. Brand-font ruling untouched (same families, same weights).
Migration or config: none. Font files added to the repository.
Tests: next build on the rig with outbound network blocked succeeds; the rendered CSS variables and font-face declarations match before and after; Playwright asserts the computed font-family on a heading and a body paragraph. Public pages: HASH-LAW (the font-face output changes the served CSS, so the incognito diff reviews it and baselines update in the gate).
Delivery WEB. Proof RIG-AUTO.
Last verified commit 6026a97. Decision owner and date: James, 2026-10-06. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6; nothing built now).

#### RENA-056 SEO locale strategy

Severity P3. Status CLOSED (no defect while one locale exists). Batch B6 (CLOSED). Overlap none.
Evidence: one locale, 'en', localePrefix as-needed; canonical is the bare path everywhere; sitemap and robots emit bare paths; nothing to alternate. Revisit with alternates.languages and x-default when a second locale lands. Optional tidy: mobile/store-pack.md links to the bare paths.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: not applicable.
Implementation status: CLOSED.

#### RENA-058 Service-worker push icon paths

Severity P3. Status CLOSED. Batch B6 (CLOSED). Overlap A.
Evidence: sw.js:94-95 reference /icons/icon-192x192.png and /icons/icon-72x72.png; both exist in public/icons; the job processor and notification service reference the same paths; every manifest icon exists.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group A. Regression evidence: not applicable.
Implementation status: CLOSED.

### B7 Scheduler, operations and GDPR

#### RENA-081 Two external triggers call the scheduler

Severity P2. Status CONFIRMED. Batch B7 (James-side steps in D-e order, after the B0 lease and heartbeat). Overlap H.
Mechanism: as above; cron-job.org (source 116.203.129.16) and the Bun client (152.55.185.11), both every five minutes.
Fix: per D-e. The code half is RENA-014's lease; the retirement is James-side and gated behind the proven heartbeat and the proven monitor.
Delivery EXTERNAL. Proof EXTERNAL-VERIFY (one week of single-tick summaries in the deploy log).
Last verified commit 66e891a (deploy and HTTP logs read 2026-10-06 18:25 to 18:57 UTC). Decision owner and date: James, 2026-10-06 (D-e). Overlap group H. Regression evidence: Step two (monitors): UptimeRobot monitors on /api/health (main) and /api/health/scheduler (Rena scheduler), both James-side; the deliberate stale test on 2026-10-06 had both triggers off from the 18:30 tick (last paired tick in the HTTP log: Bun 18:30:27, cron-job.org 18:30:55; last cadence skip in the deploy log 18:30:56); the Rena scheduler monitor alerted DOWN at 18:46:41 UTC (19:46:41 local) and the main health monitor stayed green throughout, so the two probes are independent as designed. Step three: the Railway Bun Function schedule restored at 18:49 UTC and cron-job.org left PAUSED (not deleted). Heal: first single-caller tick at 18:50:52 UTC from 152.55.185.30 (Bun/1.3.0, 200 in 332 ms), one summary line at 18:50:53, no skip; /api/health/scheduler 200 healthy at 18:51:01 with lastSucceededAt 18:50:52 (ageSeconds 10). Next tick 18:55:45 UTC, same caller, one summary at 18:55:54, no skip, no cron-job.org request since 18:30:55; heartbeat at 18:57:13 UTC 200 healthy, lastSucceededAt 18:55:45, lastFailedAt null, ageSeconds 90; /api/health 200 connected at 18:57:15. UptimeRobot's recovery notice follows the 200 and is James's to confirm.
Implementation status: James-side, in D-e order. Steps one to three DONE and proven 2026-10-06 (lease and heartbeat live; monitor alerted on the deliberate stale test; cron-job.org PAUSED; single-caller ticks resumed from Railway alone). Step four IN PROGRESS: the seven-day single-caller watch runs from 2026-10-06 18:50:52 UTC to 2026-10-13 18:50 UTC as a scheduled session routine (every six hours; read-only; reports any doubled tick, skipped line, gap over seven minutes, foreign caller or unhealthy heartbeat immediately; a clean window reports one line). Step five: cron-job.org deleted by James after seven clean days, on his word; the register closes this entry then.

#### RENA-063 Retention promises only partially implemented

Severity P1. Status PARTIAL. Batch B7. Overlap H.
Mechanism: implemented and matching the privacy page: right to work two years, DBS six months, photo ID 30 days after closure, analytics anonymisation at two years. No job for account data six years after closure, booking records six years, messages anonymised at two years, audit logs at seven years. None of those horizons is reachable within the first years of operation.
Fix: a retention matrix in code (src/lib/retention/matrix.ts) listing each class, horizon and legal-hold rule; idempotent scheduled jobs for the four missing classes on the compliance scheduler; legal hold respected (open disputes, tax retention); the privacy page wording matched to the matrix.
Migration or config: none (jobs update or delete existing rows).
Tests: retention fixtures per rule, each job touches only rows past its horizon and never a held row. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (privacy page if wording changes).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group H. Regression evidence: none yet.
Implementation status: TODO (B7).

#### RENA-064 "Download my data" claims everything but is incomplete

Severity P2. Status CONFIRMED. Batch B7. Overlap none.
Mechanism: gdpr.service.ts:490-608 exports personal info, addresses, client bookings with their review, a subset of cleanerProfile, jobs as cleaner; reviewsGiven fetched but not emitted; absent: messages, notifications and preferences, disputes, complaints, recurring agreements, reports filed, blocks, consents, agreement acceptances, document metadata, device and push tokens, analytics events, audit rows, imported reviews. Copy claims "everything we hold" (app/my-data/page.tsx:246, account/settings/page.tsx:535, export/route.ts:25-32).
Fix: D-k. Portability-export wording: the export is described as "a portable copy of your account data" with the included categories listed on the page and in the file; a separate SAR process for the full right of access: a documented request path (support@, identity check, 30-day clock) and an admin checklist in docs/ops/sar.md; the route notice reworded.
Migration or config: none.
Tests: the export's key set matches the documented categories (snapshot). Manual: none.
Delivery WEB plus DOC. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-k). Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B7).

#### RENA-065 Deletion completion has no SLA monitoring

Severity P2. Status CONFIRMED. Batch B7. Overlap H.
Mechanism: the admin queue shows requestedAt as a date only (admin/compliance/page.tsx:126); no age, threshold, overdue state or escalation; APPROVED requests are processed by the daily sweep, PENDING ones wait for a human; the user is told 30 days; the schema comment omits the APPROVED status the code uses.
Fix: age in days and an Overdue chip at 21 and 30 days; a daily job that emails the admin inbox with the oldest pending request past 21 days; the HQ command screen shows the oldest age; the schema comment corrected. Deletion stays admin-approved.
Migration or config: none.
Tests: fixtures at 20, 22 and 31 days render the right chips and the job picks the right rows. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group H. Regression evidence: none yet.
Implementation status: TODO (B7).

#### RENA-067 Crypto-shredding claim is not technically true

Severity P2. Status PARTIAL. Batch B7 (claim removed and key reference nulled now; per-document keys later). Overlap none.
Mechanism: the claim lives in two code comments (document-storage.service.ts:150-156, gdpr.service.ts:693-696); one master key, per-document key derived as sha256(master plus keyId) with keyId stored in plaintext; destroyDocument deletes the object and flags the row but never nulls keyId, so the derived key stays computable.
Fix: D-m. Now: remove the claim from both comments and describe the mechanism as envelope-style encryption under one master key with object deletion; destroyDocument also nulls encryptionKeyId in the same update so the derived key is no longer computable. Later (B9): per-document random data-encryption keys wrapped by the master key, enabling true shredding.
Migration or config: none now.
Tests: destroyDocument nulls the key reference and a decrypt attempt afterwards fails. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-m). Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B7 now; per-document keys later).

#### RENA-070 Backups and restore cannot be verified from the repository

Severity P2. Status EXTERNAL-VERIFY. Batch B7. Overlap none.
Mechanism: the only statement is docs/campaign-handover.md:146-147 (PITR continuous plus daily backups verified by James on 3 September); no restore procedure, retention or drill record.
Fix: docs/ops/backups.md recording the Railway Postgres backup settings, retention, the restore steps and one dated non-production restore drill.
Delivery DOC plus EXTERNAL (the drill). Proof EXTERNAL-VERIFY.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B7).

#### RENA-071 Store privacy material needs reconciliation with the product

Severity P2. Status CONFIRMED. Batch B7 (after B1 and B8). Overlap none.
Mechanism: mobile/store-pack.md declares first-party usage analytics (84, 108, 114-115), leaves crash diagnostics conditional (109-110), says "keep 90%" with no qualifier (33, 50); no customer store pack exists.
Fix: rebuild the Apple and Play matrices after D-b (analytics consent in-app) and RENA-060 (crash reporting) are fixed; listing copy becomes "Keep 90% on hourly cleans and 85% on fixed-price End of Tenancy and Airbnb" (same wording as the website fix); write the customer app's pack.
Delivery DOC plus EXTERNAL (store consoles). Proof: none automatable; James reviews the matrices against the product.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-b). Overlap group none. Regression evidence: not applicable.
Implementation status: TODO (B7, after B1 and N1).

#### RENA-072 ICO, DPA and breach process

Severity P2. Status PARTIAL. Batch B7. Overlap none.
Mechanism: the schema holds BreachIncident (with reportedToIcoAt and the 72-hour note), DpaAgreement and IcoRegistration; the compliance API serves breaches and ICO sections and a report_breach action; the admin compliance page shows deletions only; the privacy page names Stripe as the only processor and has no ICO complaint-right line or breach notice; docs hold nothing on DPAs or sub-processors.
Fix: the admin compliance page gains the breach, ICO and DPA sections the API already serves; the privacy page gains the ICO complaint right and names the processors (Stripe, Railway, Resend, Twilio, Cloudflare R2, Sentry if enabled); docs/ops/processors.md lists each DPA and its status; legal review of wording is EXTERNAL.
Migration or config: none.
Tests: Playwright that the three admin sections render. Manual: none.
Delivery WEB plus DOC plus EXTERNAL. Proof RIG-AUTO. HASH-LAW (privacy page).
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B7).

- RENA-001 step two: Next 15 migration lane with its own gate.
- RENA-005 step three: CSP enforcement after the report-only fortnight.
- RENA-007 step two: per-device revocation UI (list of devices) once DeviceSession rows exist.
- RENA-041 JS half: background re-lock and privacy overlay, optional per D-c.
- RENA-052: booking page decomposition after the timing table.
- RENA-056: hreflang when a second locale lands.
- RENA-067 later half: per-document data-encryption keys.
- RENA-078: stale push comments in mobile/App.tsx (204-212) and CLAUDE.md corrected with RENA-046.

#### RENA-076 Analytics anonymisation skips rows with a null IP

Severity P2. Status CONFIRMED. Batch B7. Overlap H.
Mechanism: gdpr.service.ts:624-656 updates only rows with a non-null ipAddress, so rows older than two years with a null IP but a userId keep the userId.
Fix: the WHERE becomes createdAt older than the horizon and (ipAddress not null or userId not null).
Migration or config: none.
Tests: a fixture row with null IP and a userId is anonymised. Manual: none.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-n, P2). Overlap group H. Regression evidence: none yet.
Implementation status: TODO (B7).

### B8 Native rebuild

#### RENA-040 Android splash configuration

Severity P2. Status HELD (built: e8076b3, prebuild-verified, unmerged). Batch B8 (N1). Overlap G (N1).
Evidence: e8076b3 adds the expo-splash-screen plugin blocks (android image logo-lockup.png, imageWidth 160, contain, background #EBEBEB Pro and #0D1B3E customer) and bumps versions to 1.0.4 and 1.0.2; main still carries the legacy splash keys. Prebuild on temp copies verified the native mark and the React first frame match (Pro 154x84 dp, customer 154x41 dp, centred). iOS stays on the legacy storyboard by design.
Delivery REBUILD (N1). Proof DEVICE-ONLY (Android 12 and later release build).
Last verified commit e8076b3. Decision owner and date: James, 2026-10-06 (batches into the next Android binaries). Overlap group G. Regression evidence: prebuild measurements recorded in the session; device proof pending.
Implementation status: HELD for N1.

#### RENA-060 No native crash reporting

Severity P1. Status CONFIRMED. Batch B8 (N1). Overlap G.
Mechanism: no Sentry, Crashlytics or Bugsnag in either shell; no global error handler; the web side has server and edge Sentry gated on SENTRY_DSN and a browser init on NEXT_PUBLIC_SENTRY_DSN.
Fix: the Sentry React Native SDK in both shells (native module, N1), privacy-safe config (no PII, release and runtime and update-group tags), symbol upload in the EAS build, a controlled test crash on the first N1 build. A JS-only global handler can ship by OTA meanwhile but sees JS errors only.
Migration or config: native dependency, config plugin, DSN variables in EAS (EXTERNAL).
Tests: build succeeds; a deliberate JS error reaches the dashboard on the rig build. Manual: the controlled crash on a device.
Delivery REBUILD plus EXTERNAL. Proof DEVICE-ONLY.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group G. Regression evidence: none yet.
Implementation status: TODO (N1).

#### RENA-041 Biometric protection on resume

Severity P2. Status DECISION (JS half not adopted at launch) plus TODO (Android FLAG_SECURE in N1). Batch B8 (native half, N1); the JS half is B5 and optional per D-c. Overlap G.
Mechanism: no AppState listener in either shell; the locked phase is entered only in boot(); no re-lock, no privacy overlay, no FLAG_SECURE.
Fix: per D-c the cold-start lock stands; the JS re-lock is optional hardening revisited on user evidence. The native half, Android FLAG_SECURE (expo-screen-capture or a config plugin) to keep the task-switcher snapshot blank, rides N1.
Migration or config: native dependency (N1 version bump).
Tests: none practical for the flag beyond build success. Manual: task switcher on Android shows a blank card.
Delivery REBUILD (N1). Proof RIG-PARTIAL + DEVICE (D-q).
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-c). Overlap group G. Regression evidence: none yet.
Implementation status: native half TODO (N1); JS half DECISION, optional.

#### RENA-044 No Universal Links or App Links

Severity P2. Status CONFIRMED. Batch B8 (entitlements, N1 or N2); the web files and the /open/\* route ride the same gate. Overlap C and G.
Mechanism: no associatedDomains or intentFilters in either app.json; no public/.well-known on main; both resolvers already accept https URLs of our origin but the OS never hands them over.
Fix: D-d. Role-owned paths: /open/customer/... for the customer app and /open/pro/... for Rena Pro. apple-app-site-association and assetlinks.json under public/.well-known (the same folder the Apple Pay file needs) served with the right content types; associatedDomains and autoVerify intent filters scoped to those prefixes only; the website serves /open/\* as a redirect page for browsers without the app; the C resolver maps /open/customer/<rest> and /open/pro/<rest> to the owning tab and forwards <rest>. Needs the Team ID and signing certificate fingerprints (EXTERNAL).
Migration or config: app.json entitlements and intent filters (version bump), two static files, one route.
Tests: the two files parse and name the right bundle ids; the resolver table. Manual: tap a link in Mail on each platform with the app installed and not installed.
Delivery WEB for the files and route; REBUILD for the entitlements. Proof DEVICE-ONLY for the OS half.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-d). Overlap group C, G. Regression evidence: none yet.
Implementation status: TODO (B8: web files and route plus entitlements in N1 or N2).

#### RENA-045 Mobile dependency refresh

Severity P2. Status CONFIRMED. Batch B8 (N1). Overlap G.
Mechanism: expo-doctor reports four patch mismatches in Pro and three in the customer shell; 47 advisories per shell, all in Expo CLI, Metro and Jest tooling; two doctor checks failed only for lack of network in the audit container.
Fix: npx expo install --fix to the SDK 54 patch set in both shells; doctor re-run with network; no npm audit fix; no SDK change; rides N1 because the dependency set changes the native build.
Migration or config: lockfiles and the N1 version bump.
Tests: tsc both shells; the RENA-035 static test. Manual: the N1 device matrix.
Delivery REBUILD. Proof RIG-PARTIAL + DEVICE (D-q).
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-q). Overlap group G. Regression evidence: none yet.
Implementation status: TODO (N1).

#### RENA-035 Android WebView crash fix on the canonical branch

Severity P1. Status RESOLVED. Batch B8 (device matrix as the release gate); the static test ships in B0. Overlap G.
Evidence: commit 766f98c (merge of 2a9255c): mobile/App.tsx:60-69 IOS_WEBVIEW_PROPS gated on Platform.OS === 'ios', spread at 1502; mobile-customer/App.tsx:54-63 and 1426; decelerationRate appears only inside the gated object in both shells. Both production Android channels run bundles built from 2a9255c. Root cause: react-native-webview 13.15.0's codegen spec declares decelerationRate as Double; the string 'normal' reached the Fabric host on Android and threw on the UI thread.
Remaining acceptance: a static vitest that reads both App.tsx files and fails if decelerationRate, bounces, allowsBackForwardNavigationGestures, allowsLinkPreview or sharedCookiesEnabled appear outside the IOS_WEBVIEW_PROPS block. The A37 and A24 clean-install, force-close, cold-restart and account-switch matrix is the gate of the next binaries (N1).
Delivery WEB (test). Proof RIG-AUTO; DEVICE-ONLY for the N1 matrix.
Last verified commit 6026a97. Decision owner and date: James, 2026-10-06 (merge word). Overlap group G. Regression evidence: src/lib/ci/webview-prop-gate.test.ts: fails if decelerationRate, bounces, allowsBackForwardNavigationGestures, allowsLinkPreview or sharedCookiesEnabled appears outside IOS_WEBVIEW_PROPS in either shell; passes on 6026a97.
Implementation status: RESOLVED; static test DONE (commit a2a0207, merged 6026a97); device matrix remains the B8 release gate.

### B9 Full regression and register closure

No new entries. B9 runs the required final regression matrix (section 8) end to end, confirms every entry's regression evidence field is filled, records the closing commit on each entry, and declares the hardening programme complete only when every entry is RESOLVED, CLOSED, DECISION or an explicitly deferred later-phase item. Later-phase items carried into B9 for confirmation: RENA-001 step two (Next 15), RENA-005 step three (CSP enforcement), RENA-007 step two (device list), RENA-041 JS half (optional per D-c), RENA-052 (after measurement), RENA-056 (second locale), RENA-067 later half (per-document keys), RENA-078 (stale push comments, with RENA-046).

## 8. Required final regression matrix

Customer: signup, login, logout, password reset; authenticated booking; guest booking and guest recovery; Stripe success, decline, 3DS, cancel, abandoned; confirmation to Done to Home and My Cleans showing the new booking; cancellation and refund; app killed and reopened during and after payment; session expiry inside each main tab; account switch never shows prior account data; offline, network and 5xx never shown as a genuine empty state; nested push and deep links route correctly.

Cleaner: application to native handoff; Stripe Connect incomplete and complete return; offer push to the exact offer screen; pre-accept API contains no protected customer details; two simultaneous overlapping accepts, exactly one wins; non-overlapping accepts both work; offer expiry enforced server-side; EN_ROUTE, IN_PROGRESS and COMPLETED windows enforced; cancellation and dispute races cannot resurrect stale state; session expiry returns the shell to login; completion to release and dispute pathways.

Money: duplicate webhooks; cancel versus success race; original charge plus top-up partial and full refunds; refund slice failure and retry; split-transfer payout then refund and reversal; unknown Stripe outcome reconciliation; dispute refund and release failure and retry; scheduler duplicate trigger is harmless; stuck-money operations expose every abnormal state; add-on payout at the parent rate.

Mobile: Android A37 and A24 clean install, login, force close, cold restart; account switching; iOS equivalent; renderer and content-process death recovery; external-link policy; statement download origin tests; lazy pane construction and deep-link construction; splash on Android 12 and later release build; native crash telemetry receives a controlled event; OTA and runtime compatibility check.

Privacy and operations: no consent means zero analytics sends, web and in-app; service worker never serves one account's data to another; health returns 503 with the database unavailable; scheduler heartbeat endpoint returns 503 when stale; exactly one effective scheduler execution per tick; retention fixtures hit each rule; deletion SLA monitoring works; export wording matches contents and the SAR process is documented; backups and one restore drill documented; store declarations match the product.

## 9. Change log

- 2026-10-06: B0 CLOSED. D-e step two proven (UptimeRobot scheduler monitor alerted on the deliberate stale test, main health monitor unaffected), step three executed (Railway schedule restored 18:49 UTC, cron-job.org PAUSED), single-caller ticks confirmed from Railway alone (18:50:52 and 18:55:45 UTC, one summary each, no skips) and the heartbeat healed to 200 healthy; the seven-day watch (step four) started; RENA-081 and RENA-014 updated; RENA-068's Sentry verification stays James-side.
- 2026-10-06: B0 Gate B merged (fd5f75f) and deployed (b303fabb); RENA-014 (with 062) recorded DONE for the code half with production evidence; RENA-081 carries the James-side steps.
- 2026-10-06: B0 Gate A merged (6026a97) and deployed (8545a5b9); entries 069, 061, 042, 035 (static test) and 068 (script) updated with commits and evidence; 014 recorded as built and awaiting the word.
- 2026-10-06: RENA-082 (customer in-shell signup handoff, B5, overlap M with RENA-031) and RENA-083 (build-time Google Fonts fetch, B6, P3) added, James-ruled, nothing built.
- 2026-10-06: batches reordered to the auditor's final order on James's review (B0 governance, CI and decisions; B1 authentication, sessions and privacy boundary; B2 service worker and customer recovery; B3 cleaner lifecycle and concurrency; B4 money ledger; B5 native shell OTA lane; B6 web platform; B7 scheduler, operations and GDPR; B8 native rebuild; B9 full regression and closure), with 014 and 061 pulled forward into B0.
- 2026-10-06: register created from the independent audit, the P1 challenge, the reconciliation report and James's rulings D-a to D-q with the auditor's amendments adopted. Last verified commit for all entries: 766f98c (ac917eb and e8076b3 for the two held lanes).
