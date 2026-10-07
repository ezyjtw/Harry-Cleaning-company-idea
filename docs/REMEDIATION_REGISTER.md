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
- HASH-LAW: the change touches a route in the governed public route set (canonical list docs/public-routes.json, copied in CLAUDE.md); the hash law in CLAUDE.md applies. Per D-ac the governed set is 30: the 26 baselined routes plus /get-app/pro, /get-app/customer, /open/pro and /open/customer, the set growing with the routes as they are built (James-ruled 2026-10-07): 28 at B5 (/get-app/pro, /get-app/customer), 30 at B8 (/open/pro, /open/customer), each gate adding its routes to docs/public-routes.json, CLAUDE.md and the baselines together, with deterministic fallback-representation baselines for the user-agent-redirecting ones.

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

B1 rulings, James, 2026-10-06 (on the B1 design report; the auditor's amendments adopted in full and the ten parked items ruled as the auditor recommended). The auditor's verbatim text was not relayed to the building session; each ruling below is recorded in James's own words from the build order, and the verbatim text for the B1b-only parked items (in-app consent options, banner suppression by account consent, browser Sentry under D-b, transitive dependency bumps, the unused logger and dead functions) is parked until James supplies it.

- D-r. Sub-batches: B1a (the session architecture and bridge, proxy trust, the CSRF rule; Fable 5.1 builds) and B1b (consent gate, logging, dependency patch, dead-code removal; Opus 5.5 builds after B1a merges). Applies to RENA-001, 002, 003, 006, 007, 059, 066, 074, 077, 079.
- D-s. Bridge parent validity law: a bridge code mints a WEB session only if the parent BEARER row named in the code exists, belongs to the same user, is kind BEARER, unrevoked, unexpired, and carries the current sessionVersion at redemption; the BridgeCodeUse claim and the parent verification happen in ONE transaction. Applies to RENA-003.
- D-t. Session hierarchy law: a bridged WEB session's expiry never exceeds its parent's; revoking a BEARER revokes all its WEB children atomically in the same transaction; parentJti is a revocation-group link, never re-checked per child request. Applies to RENA-003, RENA-007.
- D-u. Per-request check: one indexed session lookup carrying the user's security fields, measured not assumed; lastSeenAt via a conditional write (older than five minutes only). Applies to RENA-007.
- D-v. Legacy tokens: thirty-day grandfather with a fixed, documented, tested cutoff constant; missing sv reads as 0; after the cutoff a missing jti or sid is invalid. Applies to RENA-007, RENA-074.
- D-w. Revocation rules: device logout revokes that session and its children only; account switch revokes only the token being left; sign-out-everywhere (new route plus doors on customer settings, the cleaner profile and the /app/profile room) revokes all rows and bumps sessionVersion, current device included; password change and reset stamp passwordChangedAt, bump sessionVersion and revoke rows; the cleaner profile password path gains the current-password check, the stamp and revocation, with copy telling her she may need to sign in again; deletion and suspension revoke rows. Applies to RENA-007.
- D-x. Mint paths: every current token-mint path (login, signup, bridge, NextAuth callbacks) updates in B1a so no post-B1 path can issue an untracked session; the RENA-031/082 native join UX handoff stays in B5 and consumes this primitive. Applies to RENA-007, RENA-031, RENA-082.
- D-y. Proxy and IP: one Edge-safe pure getClientIp() used everywhere, replacing both chooser copies and the twelve raw-header routes; default rightmost x-forwarded-for then x-real-ip; cf-connecting-ip honoured only under TRUSTED_PROXY=cloudflare. From the record: TRUSTED_PROXY has been cloudflare since the July pen-test remediation gate and renacleaning.co.uk is proxied through Cloudflare (DNS migrated in May; only the Microsoft 365 mail records are DNS-only), so the challenge's "unset" assumption was wrong and is retracted. In cloudflare mode cf-connecting-ip is trusted only when the immediate peer (rightmost x-forwarded-for as Railway supplies it) is within Cloudflare's published ranges, falling back to the rightmost entry otherwise, so a request sent directly to the .up.railway.app origin cannot forge its bucket. Whether the Railway-generated domain should redirect to the canonical host or be removed is external and James's call, named for later. Applies to RENA-002.
- D-z. CSRF rule, precedence as ordered: GET, HEAD and OPTIONS no check; webhooks and cron keep their own signature or secret security; a valid Authorization or x-rena-shell header passes the CSRF layer (a bypass signal, never authentication); cookie-authenticated mutations require exact Origin equality (scheme, host, port against NEXTAUTH_URL) when Origin is present, else Sec-Fetch-Site same-origin or none; never same-site; everything else 403 JSON. Exempt only NextAuth's own protocol routes, never all of /api/auth/: Rena's own routes under it (bridge, shell-logout, sign-out-all) are covered. A regression test proves an arbitrary-origin CORS preflight is not granted. Applies to RENA-006, RENA-079.
- D-aa. RENA-031 and RENA-082 are P1 (the recruitment week) and split: B1a updates the signup token-mint paths; B5 builds the wizard-to-native handoff UX for both apps as one design consuming the new primitive. RENA-084 stays parked pending James's reproducible symptom; no fix guessed. RENA-068 is parked, verified after the telemetry changes land.
- D-ab. B1b rulings (James, 2026-10-06, both reviewers concurring): deviations 1, 2, 4 to 11 of the B1b gate accepted. Deviation 3 not accepted: in production an unavailable or unconfigured email provider never returns send success; the email service returns failure and logs a structured error; callers handle it honestly without necessarily rolling back the underlying operation where email is secondary (signup still creates the account and the person sees "Account created, but we couldn't send the verification email" with a retry); nobody is told a message was sent when it was not; development may warn and return true. Privacy page dated 6 October 2026, sanctioned under the hash law. The hash law baseline is all 26 public routes, listed in CLAUDE.md beside the law and in docs/public-routes.json, which the hash tool and CI read. LOG_HMAC_KEY is James's external: a dedicated fresh 64-character random secret unrelated to any JWT, encryption or provider secret; rotating it later breaks correlation between old and new pseudonyms, which is acceptable. Applies to RENA-059, RENA-066, RENA-077, RENA-085, RENA-086.
- D-ac. Programme rulings (James, 2026-10-07) on the B2 to B9 design reports. The reports and their rulings are committed in docs/design (README.md, B2.md to B9.md, lanes.md); each batch implements its approved report plus its "Rulings and amendments" section, and where they differ the rulings win. Every deviation named in each report is approved (B2 nine, B3 nine, B4 nine, B5 ten, B6 nine, B7 eleven, B8 six; B9's four are superseded where the programme order moves them). Order: B2 (B2a then B2b), B3, B4, B5, B6, B7, B8, the pre-closure code lane (RENA-004 diag endpoint and preview beacons deleted, string law applies; RENA-007 step two, the signed-in devices UI), N15 (the Next 15 and React 19 migration as scoped in B6.9, revert branch staged, own gate; the final regression runs on Next 15), then B9 (pure closure, no product code). Gate protocol every batch: checklist, results tables, deviations for ruling, parked list, UAT list, hash sweep on the governed set, incognito diff, and a plain list of departures from the design (departures need James's word). Business-rule rulings carried in the batch files, recorded here as rule changes: B2 only a definitive 401 triggers session loss (403 is an access or account-state error and never touches the session; 429 and 5xx retryable; network failure is offline; only a successful empty response renders empty), 15-second coalescing for both apps with explicit invalidation bypassing it; B3 Flexible-time jobs may enter EN_ROUTE and IN_PROGRESS from 06:00 London and COMPLETED anchors to checkedInAt plus duration minus 30 minutes, nonexistent spring times rejected as invalid booking times and ambiguous autumn times take the later occurrence, deletion is blocked by a provisional assignment but not by backup, reserve or unaccepted offer membership; B4 add-on payout follows the parent service's rate unless the add-on defines its own (products stays 90%), a chargeback holds unreleased funds and release resumes only when moneyHoldReasons(booking) is empty, legacy money data is never guessed (unprovable slices migrate UNKNOWN or NEEDS_RECONCILE and block affected money actions until reconciled), admin-managed PlatformConfig defaults are create-if-missing; B5 the native handoff uses a short-lived single-use user- and role-bound code redeemed by native fetch and no long-lived native credential ever exists in page JS, WebView storage, URLs or postMessage, website signup stops minting native Bearers, x-rena-shell selects a response shape and is never authentication, a definitive 403 resets the Pro consecutive-401 counter; B7 legal@ is the one published rights inbox and the storage wording is ruled (external legal review before publish); B8 ADMIN is rejected on fresh login and on restored Bearer at boot, bridge redemption, handoff and account switch. Customer push (ruled 2026-10-07, separately): activates in B5, PUSH_ACTIVATED flipping true in the same OTA as the deep-link resolver and the notification rationale card; the C7 hold is lifted at that point and recorded as James's decision; until then it stays off because taps cannot yet route. RENA-084 builds all three mechanisms in B2 (D-aa's parking superseded). New entries RENA-087 to RENA-095 (the B4 survey additions N1 to N9) recorded under B4. Applies to every B2 to B9 entry.

## 4. Overlap groups: one architectural change designed once

- A. Service-worker policy: 048, 055, 058. One sw.js (v6) that never touches /api/\*, caches static assets by extension, precaches the offline page, keeps the push handlers. WEB.
- B. Session design and session-lost contract: 003, 007, 019 (customer half), 029, 074, with 023's sign-in door and 020/021's auth-derived checkout mode, and 084's role-home guards (the website's back path from Messages). One design (D-g) with three edges: page (401/403 navigates to /login with callbackUrl; 5xx shows an error card with Retry; never an empty state), native (two consecutive 401s on the badges poll call logout; 403 and 5xx never do), server (DeviceSession, sessionVersion, pwdAt). WEB plus OTA both shells.
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
- B1 Authentication, sessions and privacy boundary: 001, 002, 003, 006, 007, 009, 059, 074, 066, 077, 079 (004 held and 008 decided sit here without batch work). Split per D-r: B1a (002, 003, 006 rule, 007, 074) BUILT 2026-10-06 on claude/b1a-session-core, commits 7fd9f92, 70ee97b, bccbfae and 8a52215, at the gate awaiting James's walk and word; B1b (001, 059, 066, 077, 079 deletions, 009 recorded) follows after the B1a merge. CLOSED 2026-10-07: B1a merged 0165dd3 (deployment dda67793), B1b merged ec445c9 (deployment 5bb35e2e), James's word on each; the B1a walk passed on both apps and the website, both lanes. Tails running outside the batch: the first production email or job line read for 066 and 077, James's email-working signup walk for 077, and the Railway-generated domain decision (002, external). The B1a revert branch claude/b1a-revert-ready (f777a97) is retired on James's word; the session's git proxy refuses branch deletion, so the remote ref stays until James removes it in GitHub, and nothing on it is for merge.
- B2 Service worker and customer recovery: 048, 055, 018, 019, 020, 021, 023, 025, 053, 054, 084. Split B2a then B2b (D-ac). Design and rulings: docs/design/B2.md.
- B3 Cleaner lifecycle and concurrency: 012, 026, 027, 028, 030, 032, 033, 034, with the twelve-helper Europe/London sweep (D-ac). Design and rulings: docs/design/B3.md.
- B4 Money ledger: 010, 011, 013, 015, 016, 017, 073, 075, 080, 087, 088, 089, 090, 091, 092, 093, 094, 095. Design and rulings: docs/design/B4.md.
- B5 Native shell OTA lane: 022, 024, 029, 031, 036, 037, 038, 039, 043, 046, 047, 082, and the JS half of 041 (DECISION, record only); customer push activation (D-ac). Design and rulings: docs/design/B5.md.
- B6 Web platform: 005, 049, 050, 051, 052, 057, 083, 086, the ui barrel and Input.tsx deletion, and the Next 15 scoping as design only (B6.9; execution is the N15 lane) (056 and 058 closed). Design and rulings: docs/design/B6.md.
- B7 Scheduler, operations and GDPR: 062, 063, 064, 065, 067, 070, 071, 072, 076, 081, 085 (014, 061, 068, 069 delivered in B0). Design and rulings: docs/design/B7.md.
- B8 Native rebuild: 040, 060, the native half of 041, 044, 045, then 035's device matrix as the release gate. Design and rulings: docs/design/B8.md.
- Pre-closure code lane (after B8, before N15): 004 (the diag endpoint and its preview beacons deleted, string law applies) and 007 step two (the signed-in devices UI on DeviceSession: device and platform, last seen, current session marker, sign out this device). Own gate. Rulings: docs/design/lanes.md.
- N15 Next 15 and React 19 migration (after the pre-closure lane, before B9): 001 step two, exactly as scoped in B6.9, revert branch staged, own gate; the final regression runs on Next 15. Rulings: docs/design/lanes.md.
- B9 Full regression and register closure: pure closure, no product code; TRUSTED_PROXY verified by a live header test against the real edge topology and the actual value recorded. Design and rulings: docs/design/B9.md.

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
Implementation status: PARKED (James-ruled 2026-10-06, D-aa, superseding the same-day DONE ruling below): verified after the B1b telemetry changes land. Earlier same day: DONE, James-ruled 2026-10-06: verified via production dashboard, rig run not required. James checked sentry.io and confirmed SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN set in Railway. The script (scripts/sentry-test-event.ts, commit a2a0207, merged 6026a97) stays as the tool for any future check; it reads the DSN from the environment only. The rig environment changes (SENTRY_DSN as an environment variable, sentry.io and the project's ingest host allowed by the network policy) stand for whichever future session starts; no rig run is owed. Parked: whether the dashboard showed events present or no events yet at the time of the check is James's to state; the ruling stands either way.

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
Last verified commit 17f73d1. Decision owner and date: James, 2026-10-06 (B1b build order: next-auth and sharp, transitive patches only within existing ranges, no Next 15). Overlap group none. Regression evidence: e2e/auth-header.spec.ts (six malformed Authorization headers: public page 200, protected page redirects, never 500); the full Playwright suite 28 of 28 and both integration suites on the patched dependencies; rig website login (credentials) and native login (token and bridge code) on next-auth 4.24.15.
Implementation status: step two (Next 15 and React 19) is the N15 lane per D-ac, after the pre-closure code lane and before B9. DEPLOYED: merged to main ec445c9 (James's word 2026-10-07 after the B1a walk passed), Railway deployment 5bb35e2e SUCCESS 2026-10-06 22:02Z, boot clean (no pending migrations, seed synced, Ready in 723ms); /privacy live with 6 October 2026 and 7.2a; /api/health 200; scheduler healthy. DONE for the B1 bump. Built for B1 (commit 17f73d1), at the gate: next-auth 4.24.15, sharp 0.35.5; axios 1.20.0, form-data 4.0.6, js-yaml 4.3.2, fast-uri 3.1.8 inside their parents' ranges; forced only by those packages' own ranges: uuid 11.1.1 (next-auth), follow-redirects 1.16.1 (axios), hasown 2.0.4 (form-data), libvips 1.3.4 (sharp). The Next advisories stay the B6 lane.

#### RENA-002 Rate limiting is process-local and proxy trust is deployment-dependent

Severity P1. Status PARTIAL. Batch B1. Overlap none.
Mechanism (corrected per D-y, 2026-10-06): three in-memory limiters (src/middleware.ts, src/lib/rate-limit.ts, src/lib/utils/security.ts) reset on restart; one Railway process today. The database-side account lockout (five failures, fifteen minutes; src/lib/auth/options.ts) survives restarts and covers both login paths. The earlier claim that TRUSTED_PROXY was unset is retracted: it has been cloudflare since the July pen-test remediation gate and the domain is proxied through Cloudflare. The residual defect was that cloudflare mode trusted cf-connecting-ip unconditionally, so a request sent straight to the .up.railway.app origin could carry a forged header and a fresh bucket; two copies of the chooser existed (middleware and rate-limit) and twelve audit routes stored the raw, unsplit x-forwarded-for header.
Fix (D-y, built): src/lib/http/client-ip.ts is the one Edge-safe pure chooser used by the middleware, the route limiters, the consent route, the NextAuth error log line and the twelve audit routes. Default: rightmost x-forwarded-for then x-real-ip; in cloudflare mode cf-connecting-ip is trusted only when the rightmost x-forwarded-for peer sits inside Cloudflare's published ranges (src/lib/http/cloudflare-ranges.ts, a code constant refreshed in a gate). A shared store for the limiters is deferred until replicas exist (railway.json carries none).
Migration or config: none in the repository. External, James's call, named: whether the Railway-generated domain redirects to the canonical host or is removed. James verifies the Cloudflare range snapshot against the live page in the B1a gate (the building session's egress cannot reach cloudflare.com). Verified 2026-10-07: James read cloudflare.com/ips and relayed the live lists; the snapshot in src/lib/http/cloudflare-ranges.ts matches exactly, 15 IPv4 and 7 IPv6 ranges, no difference (EXTERNAL-VERIFY satisfied).
Tests: src/lib/http/client-ip.test.ts, cloudflare mode with a Cloudflare IPv4 peer, an IPv6 edge peer, a direct-to-origin peer and a non-Cloudflare proxy chain, railway mode, unset mode, each with spoofed cf-connecting-ip and spoofed leftmost x-forwarded-for; src/middleware.test.ts wires it. Manual: none.
Delivery WEB plus EXTERNAL (the domain question, still open, James's call). The retraction of the earlier TRUSTED_PROXY unset claim stands recorded in the mechanism above and in D-y. Proof RIG-AUTO plus EXTERNAL-VERIFY (range snapshot).
Last verified commit bccbfae. Decision owner and date: James, 2026-10-06 (D-y). Overlap group none. Regression evidence: unit matrix passing (16 cases) on the rig; typecheck and lint clean.
Implementation status: DEPLOYED and DONE: merged to main 0165dd3 (James's word), Railway deployment dda67793 SUCCESS 2026-10-06 21:52Z, boot clean (migration 20261007090000_device_sessions applied, 17 migrations, reference seed synced); James's walk PASSED on both apps and the website, both lanes (login, logout, account switch, password change, sign-out-everywhere), his word 2026-10-07. Built (B1a, commits 7fd9f92, 70ee97b, bccbfae and 8a52215), at the gate; DONE only after James's walk and the merge.

#### RENA-003 Session-bridge single use is per process

Severity P2. Status CONFIRMED. Batch B1. Overlap B.
Mechanism: src/lib/auth/session.ts:54 holds consumed bridge JTIs in a module Map swept every sixty seconds; a 60-second signed JWT (64-70) can be consumed again after a restart or on a second instance; no table exists.
Fix: part of D-g. The consumed bridge JTI becomes a row (insert-as-claim; unique violation means replay) in the same session tables; a daily sweep deletes expired rows. The R8 self-heal (spent code plus existing cookie redirects) is unchanged.
Migration or config: covered by the D-g migration.
Tests: replay rejected with the Map cleared between calls; two concurrent consumptions against rig Postgres, one wins. Manual: shell login round trip both apps.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 7fd9f92,. Decision owner and date: James, 2026-10-06 (D-g, D-s, D-t). Overlap group B. Regression evidence: integration suite against the rig Postgres (src/lib/auth/session.integration.test.ts, opt-in, wired into the CI e2e job): two redemptions of one code racing give exactly one winner and one WEB child, the spent code refused afterwards; parent validity law cases (wrong user, unknown parent, WEB parent, revoked, expired, stale version) each refused; hierarchy law (child expiry capped by the parent, a raw parent write leaves the child valid, the helper revokes parent and children in one statement). Unit: claims carry the parent jti and a 60 s life.
Implementation status: DEPLOYED and DONE: merged to main 0165dd3 (James's word), Railway deployment dda67793 SUCCESS 2026-10-06 21:52Z, boot clean (migration 20261007090000_device_sessions applied, 17 migrations, reference seed synced); James's walk PASSED on both apps and the website, both lanes (login, logout, account switch, password change, sign-out-everywhere), his word 2026-10-07. Built (B1a, commits 7fd9f92, 70ee97b, bccbfae and 8a52215): the Map is gone; BridgeCodeUse insert-as-claim and the parent check run in one transaction in verifyAndConsumeBridgeCode (src/lib/auth/session.ts); the daily sweep rides the compliance scheduler. At the gate; DONE after James's walk and the merge.

#### RENA-006 CSRF helper unused on cookie-authenticated mutations

Severity P2. Status PARTIAL. Batch B1. Overlap none.
Mechanism: src/lib/utils/csrf.ts and src/lib/utils/rbac.ts have no importers. Protection is NextAuth's default cookie attributes (httpOnly, sameSite lax, secure in production) and the bridge-minted cookie's sameSite lax; no Origin, Referer or Sec-Fetch-Site check; no API CORS. SameSite lax keeps the session cookie off cross-site POSTs in current browsers; residual exposure is browsers without SameSite enforcement and same-site subdomains. Shells use a Bearer and are unaffected.
Fix: document the model in docs/architecture.md; in the middleware API branch, for non-GET requests carrying a session cookie, require Sec-Fetch-Site same-origin or none, or an Origin matching the canonical host; Bearer requests without a cookie pass; webhook routes (no cookie) pass. Delete csrf.ts and rbac.ts (RENA-079).
Migration or config: none in the repository. External: NEXTAUTH_URL must be present as a build-visible Railway service variable (the canonical origin is inlined at build). Confirmed present by James, 2026-10-07.
Tests: foreign Origin plus cookie 403; same-origin plus cookie passes; Bearer without Origin passes; Stripe webhook passes. Manual: website booking, login, settings save; shell badges poll and statement download.
Delivery WEB. Proof RIG-AUTO.
Last verified commit bccbfae. Decision owner and date: James, 2026-10-06 (D-z). Overlap group none. Regression evidence: src/lib/http/csrf.test.ts (the precedence matrix: safe methods, webhook and cron exemptions, NextAuth protocol routes exempt and eight Rena routes under /api/auth not exempt, bypass headers, no-cookie pass, both cookie prefixes and chunks, exact Origin equality against seven near-misses, Origin over Sec-Fetch-Site, same-origin and none pass, same-site and cross-site refused, unknown canonical refused); src/middleware.test.ts (403 JSON with no-store for a foreign Origin, Rena's /api/auth routes covered, same-origin passes, shell header passes, Bearer passes, GET untouched, and the ruled regression: an arbitrary-origin preflight receives no Access-Control-Allow header). Rig curl matrix on the production build in the gate report.
Implementation status: DEPLOYED and DONE: merged to main 0165dd3 (James's word), Railway deployment dda67793 SUCCESS 2026-10-06 21:52Z, boot clean (migration 20261007090000_device_sessions applied, 17 migrations, reference seed synced); James's walk PASSED on both apps and the website, both lanes (login, logout, account switch, password change, sign-out-everywhere), his word 2026-10-07. Built for the rule (B1a, commit bccbfae: src/lib/http/csrf.ts evaluated in the middleware's API branch; the model documented in docs/architecture.md). csrf.ts and rbac.ts deleted in B1b (RENA-079) after the rule deployed. Was at the gate.

#### RENA-007 Mobile Bearer has no per-device revocation

Severity P2. Status PARTIAL. Batch B1. Overlap B.
Mechanism: src/lib/auth/session.ts:32-43 signs a 30-day JWT with no JTI and no version; verifyBearerToken (105-152) rejects DEACTIVATED, suspended and pre-password-change tokens on every call, so account-level revocation exists; device-level does not. shell-logout expires only the NextAuth cookie names and the shells call it without a Bearer.
Fix: D-g. DeviceSession rows (jti, userId, kind bearer or web, createdAt, lastSeenAt, revokedAt); the Bearer and the bridge-minted web token carry the jti and the user's sessionVersion; verification requires an unrevoked row and a matching version; shell-logout (now with the Bearer) revokes that device's row; "Sign out of all devices" in account settings bumps sessionVersion; password change and reset bump sessionVersion as well as passwordChangedAt; account switch revokes only the leaving device's row.
Migration or config: User.sessionVersion Int default 0; DeviceSession table; the bridge code table (RENA-003).
Tests: revoked jti is 401; version bump invalidates every live token; cookie session for the website unaffected; account switch leaves the other account's devices alive. Manual (the heaviest gate): ceremonial drive plus James's walk of login, logout, account switch, password change and sign-out-everywhere on both apps and the web before merge.
Delivery WEB plus OTA both shells (send the Bearer on logout). Proof RIG-AUTO plus the ruled walk (DEVICE).
Last verified commit 7fd9f92,. Decision owner and date: James, 2026-10-06 (D-g, D-t to D-x). Overlap group B. Regression evidence: unit (src/lib/auth/session.test.ts): the tracked path is one deviceSession lookup and no user lookup, lastSeenAt written only when older than five minutes and only conditionally, every rejection branch (revoked, expired, wrong kind, wrong user, stale version on row or claim, suspended, deactivated, post-password-change), the cutoff constant 2026-11-07 with an injected clock (accepted the day before, refused at and after, without a database read); route tests for shell-logout (Bearer and cookie paths), sign-out-all and the bridge cookie. Integration on the rig: Bearer minted and verified with the tracked path measured under 500 ms; cookie-only device logout revokes the bridged device (parent and children) and a plain web cookie only itself; sign out everywhere bumps the version and kills Bearer, bridged cookie row and web row while a fresh mint lives and another user is untouched; the password path stamps, bumps and revokes in one transaction; lazy legacy upgrade yields one row per cookie jti with sv 0; the sweep deletes spent codes and ended rows.
Step two (D-ac, 2026-10-07): the signed-in devices UI (device and platform, last seen, current session marker, sign out this device) is built in the pre-closure code lane after B8, own gate.
Implementation status: DEPLOYED and DONE: merged to main 0165dd3 (James's word), Railway deployment dda67793 SUCCESS 2026-10-06 21:52Z, boot clean (migration 20261007090000_device_sessions applied, 17 migrations, reference seed synced); James's walk PASSED on both apps and the website, both lanes (login, logout, account switch, password change, sign-out-everywhere), his word 2026-10-07. Built (B1a, commits 7fd9f92, 70ee97b, bccbfae and 8a52215). DeviceSession and BridgeCodeUse models, User.sessionVersion, migration 20261007090000_device_sessions; src/lib/auth/device-session.ts (rows, revocation, sweep, cutoff), src/lib/auth/session.ts (mint, bridge, per-request check), NextAuth callbacks, the bridge route, login and signup, shell-logout, the new /api/auth/sign-out-all with doors on customer settings, the cleaner profile page and the /app/profile room, change-password, reset, the cleaner profile password path, deletion, suspension, the repository soft delete. No shell change: today's shells revoke their device through the cookie's parent; the "Bearer on logout" OTA piece is named for James's word in the B5 lane. At the gate; DONE after James's walk and the merge.

#### RENA-009 Account-state enumeration

Severity P3. Status DECISION (no change). Batch B1. Overlap none.
Evidence: the web NextAuth path is uniform; the shell JSON login distinguishes suspended and locked (src/lib/services/auth.service.ts:140-146); signup and check-email disclose existence by design and are rate limited; forgot-password and resend-verification use constant messages.
Delivery none.
Last verified commit 8677867. Decision owner and date: James, 2026-10-06 (D-h), recorded again in B1b. Overlap group none. Regression evidence: not applicable; nothing in B1a or B1b changes a login, signup, reset or check-email response.
Implementation status: DECISION, no change (recorded in B1b).

#### RENA-059 First-party analytics sent regardless of consent

Severity P1. Status CONFIRMED. Batch B1. Overlap none.
Mechanism: consent is stored in localStorage and read only by the banner (src/components/CookieConsent.tsx:15-40, 53); src/lib/hooks/useAnalytics.ts sends every event and the unload beacon without consulting it (54-72, 87-115); the Decision-1 funnel fires on mount (src/app/[locale]/services/[category]/page.tsx:1399-1416); the server stores the IP (src/app/api/analytics/events/route.ts:70); the banner never renders in-shell (CookieConsent.tsx:100) while the hook still sends.
Fix: one consent gate (readConsent) that sendEvent, the beacon and the session-id write all consult; no analytics event, identifier or storage write before consent.analytics is true. In-shell per D-b: the apps ask once on the first signed-in entry with the same choice as the website; the answer is stored where the hook reads it. Server-side user linkage derived from the session, not the client.
Migration or config: none.
Tests: no consent means zero analytics requests in Playwright; Essential only means zero; accepted means events flow; in-shell UA before the first answer means zero. Manual: first signed-in entry on both apps shows the ask once.
Delivery WEB (the in-shell ask is an L2 or shell-gated web surface; no OTA). Proof RIG-AUTO. HASH-LAW on /services/[category] if the funnel hook changes there.
Last verified commit 843b7b5. Decision owner and date: James, 2026-10-06 (D-b; B1b build order: precedence, two in-shell choices, banner suppression by the account answer, browser Sentry outside consent with the scrubber). Overlap group none. Regression evidence: src/lib/consent.test.ts (nine precedence cases); e2e/consent.spec.ts (no choice zero, Essential only zero, Accept All flows, shell user agent zero); rig request-count matrix on both builds (gate report): before, events and the session id fire with no choice, after Essential only, for the signed-out app user agent and after sign-in; after, zero in each of those and on both apps before the answer, events only after Allow or Accept All, the app ask shown once, the stored account answer suppressing the website banner. Hash sweep, same rig, main against the branch, 26 public pages with a self-control: 25 identical, /privacy changed (sanctioned wording).
Implementation status: DEPLOYED: merged to main ec445c9 (James's word 2026-10-07 after the B1a walk passed), Railway deployment 5bb35e2e SUCCESS 2026-10-06 22:02Z, boot clean (no pending migrations, seed synced, Ready in 723ms); /privacy live with 6 October 2026 and 7.2a; /api/health 200; scheduler healthy. DONE (consent matrix proven on the rig, zero events without consent). Built (B1b, commit 843b7b5), at the gate. src/lib/consent.ts; CookieConsent on the gate (same markup and strings, server renders nothing); src/components/app/ShellConsentSheet.tsx (Allow analytics, Essential only, privacy and settings door) on the first signed-in entry pane; src/components/app/AnalyticsChoice.tsx in the Pro profile room and the customer settings page; useAnalytics gated (no session id, events or beacon without consent; calls during the identity lookup wait in memory); join conversion without the email; events route attributes from the session; consent route records the policy version; privacy section 7 updated (in-app ask, account-wide choice, error monitoring disclosed as not analytics, in-app settings). RENA-071 cross-reference: the store declarations reconcile against this behaviour in B7.

#### RENA-074 Bridge-minted web sessions skip the password-change check

Severity P1. Status CONFIRMED. Batch B1. Overlap B.
Mechanism: src/app/api/auth/session-bridge/route.ts:155-165 encodes the NextAuth token without the pwdAt claim that the jwt callback sets (src/lib/auth/options.ts:99); getSessionUser's password-change check (src/lib/auth/session.ts:182-189) runs only when pwdAt is present, so a shell's web session survives a password change.
Fix: set pwdAt at the bridge mint; with D-g the sessionVersion check closes it a second way.
Migration or config: covered by D-g.
Tests: bridge-minted session is rejected after a password change; before the change it is accepted. Manual: part of the D-g walk.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 7fd9f92,. Decision owner and date: James, 2026-10-06 (D-n, P1; D-v). Overlap group B. Regression evidence: src/app/api/auth/session-bridge/route.test.ts decodes the minted cookie and asserts pwdAt, sid and sv are present and the cookie's Max-Age is capped by the WEB row's expiry; the integration suite's version bump kills the bridged cookie's row.
Implementation status: DEPLOYED and DONE: merged to main 0165dd3 (James's word), Railway deployment dda67793 SUCCESS 2026-10-06 21:52Z, boot clean (migration 20261007090000_device_sessions applied, 17 migrations, reference seed synced); James's walk PASSED on both apps and the website, both lanes (login, logout, account switch, password change, sign-out-everywhere), his word 2026-10-07. Built (B1a, commits 7fd9f92, 70ee97b, bccbfae and 8a52215): the bridge mints pwdAt, sid and sv (src/app/api/auth/session-bridge/route.ts) and the sessionVersion check closes it a second way. At the gate; DONE after James's walk and the merge.

#### RENA-066 Production logs contain personal data and whole payloads

Severity P2. Status CONFIRMED. Batch B1. Overlap K.
Mechanism: src/lib/infrastructure/job-processor.ts:174 logs the whole email payload (address, name, subject, body); 169, 184, 199 log email or phone; 319 and 370 whole payloads; src/lib/services/email.service.ts:172 logs recipient and subject on every production send and 163-166, 181 on failure; its dev branch (118-130) also fires in production when Resend is unconfigured (RENA-077); src/lib/services/scheduler.service.ts:435-437 logs a cleaner's home postcode; src/lib/utils/errors.ts:57 logs the raw thrown value; Sentry has no beforeSend and error-monitoring.ts:108-117 forwards the whole context.
Fix: D-l. A structured logger (src/lib/log.ts) that accepts an allowlist of keys (ids, statuses, counts, durations, booking refs) and drops everything else; where correlation with an email or phone is essential (delivery failures), a keyed HMAC (LOG_HMAC_KEY) of the identifier; replace the lines above; Sentry init gains beforeSend that strips headers, cookies, query strings and extra payloads; a CI grep fails on console.log with payload, to:, email or phone in src/lib and src/app/api.
Migration or config: LOG_HMAC_KEY in Railway (EXTERNAL, one variable). Set by James, 2026-10-07, per D-ab (a dedicated fresh 64-character random secret).
Tests: logger drops non-allowlisted keys; HMAC is stable and keyed; the CI grep. Manual: read one production send line after deploy.
Delivery WEB plus EXTERNAL. Proof RIG-AUTO.
Last verified commit 127d0a5. Decision owner and date: James, 2026-10-06 (D-l; B1b build order). Overlap group K. Regression evidence: unit tests src/lib/log.test.ts (allowlist keeps ids, statuses, counts, durations, codes, provider and endpoint names; drops personal and payload keys listing names only; nested objects dropped; strings capped and redacted; \*Ref keys accept only a pseudonym or null; errors reduced with a redacted message and no stack or raw provider object; pseudonym null without LOG_HMAC_KEY, keyed, stable, refuses a short key; one JSON line in production), src/lib/redact.test.ts, src/lib/sentry-scrub.test.ts (headers, cookies, query strings, bodies, extra and unsafe contexts stripped, user to id, console breadcrumbs dropped, console integration removed), src/lib/ci/log-hygiene.test.ts (fixtures plus a clean repository scan), src/app/api/shell/diag/route.test.ts (sanctioned beacon fields only), src/lib/infrastructure/job-processor.log.test.ts (no payload, address or number in any job line); rig production build: a real send failure logged as one JSON line with category, provider, reduced error and recipientRef null (no key on the rig), zero address-like strings in the server log across the full drive.
Implementation status: DEPLOYED: merged to main ec445c9 (James's word 2026-10-07 after the B1a walk passed), Railway deployment 5bb35e2e SUCCESS 2026-10-06 22:02Z, boot clean (no pending migrations, seed synced, Ready in 723ms); /privacy live with 6 October 2026 and 7.2a; /api/health 200; scheduler healthy. DONE once the first production email or job line after boot is read as JSON with no address, subject or body (none emitted yet at the time of the deploy read). Built (B1b, claude/b1b-privacy-telemetry, commit 127d0a5), at the gate; not merged until James's B1a walk passes and his word. src/lib/log.ts, src/lib/redact.ts, src/lib/sentry-scrub.ts (server and browser inits), the twenty named sites plus the catchment postcode and one further line the grep flagged (email.service backup-offer count), the diag route schema, eslint no-console as error for src/lib and src/app/api with src/lib/log.ts the only file exemption, scripts/check-log-hygiene.ts in the CI web job. External, named: LOG_HMAC_KEY set in Railway by James (until then pseudonyms are null). 183 pre-existing console lines in those folders keep their inline eslint-disable comments and pass the rule (none carries a payload per the grep); migrating them is outside the locked design and listed for James.

#### RENA-077 Email service dev branch logs addresses and body in production when Resend is unconfigured

Severity P3. Status CONFIRMED. Batch B1. Overlap K.
Mechanism: src/lib/services/email.service.ts:118 guard is NODE_ENV not production OR no Resend client.
Fix: folded into RENA-066 (the branch logs through the allowlisted logger and never the body).
Delivery WEB. Proof RIG-AUTO.
Last verified commit (B1b follow-up, see Implementation status). Decision owner and date: James, 2026-10-06 (D-ab). Overlap group K. Regression evidence: src/lib/services/email.service.log.test.ts (production with no provider: one structured error, returns false, nothing identifying; development warns and returns true); src/lib/services/auth.service.register.test.ts (signup creates the account when the send fails, returns false or throws, and the message says the email could not be sent); src/app/api/auth/resend-verification/route.test.ts (the signed-in owner hears the true outcome, everyone else the constant message); e2e/signup-email-failure.spec.ts (the signup page shows the notice, the retry reports it still could not send, Continue reaches the account).
Implementation status: DEPLOYED: merged to main ec445c9 (James's word 2026-10-07 after the B1a walk passed), Railway deployment 5bb35e2e SUCCESS 2026-10-06 22:02Z, boot clean (no pending migrations, seed synced, Ready in 723ms); /privacy live with 6 October 2026 and 7.2a; /api/health 200; scheduler healthy. DONE once James's email-working signup walk lands on /account and the first production send line is read (a session never writes the production database, so the signup is James's). Built (B1b, commit 127d0a5, rebuilt per D-ab in the follow-up commit on the same branch), at the gate. Production with no provider returns failure and logs email.not_sent; registerUser reports verificationEmailSent and an honest message; the signup page shows "Account created, but we couldn't send the verification email" with Try again and Continue; resend-verification tells the signed-in owner the truth and everyone else the constant message (RENA-009 unchanged); the cleaner verification log lines record the real outcome.

#### RENA-079 Dead code: csrf.ts, rbac.ts, ui/Modal.tsx

Severity P3. Status CONFIRMED. Batch B1 (csrf.ts, rbac.ts); Modal.tsx in B6. Overlap none.
Mechanism: src/lib/utils/csrf.ts, src/lib/utils/rbac.ts and src/components/ui/Modal.tsx have no importers.
Fix: csrf.ts and rbac.ts removed in RENA-006; Modal.tsx becomes the dialog primitive in RENA-049/050.
Delivery WEB. Proof RIG-AUTO (tsc, lint).
Last verified commit 8677867. Decision owner and date: James, 2026-10-06 (B1b build order). Overlap group none. Regression evidence: repo-wide zero-import greps quoted in the gate (src, root components, scripts, e2e, both shells); typecheck, lint and the unit suite after deletion.
Implementation status: DEPLOYED: merged to main ec445c9 (James's word 2026-10-07 after the B1a walk passed), Railway deployment 5bb35e2e SUCCESS 2026-10-06 22:02Z, boot clean (no pending migrations, seed synced, Ready in 723ms); /privacy live with 6 October 2026 and 7.2a; /api/health 200; scheduler healthy. DONE for csrf.ts and rbac.ts (the rule deployed in B1a first). Built (B1b, commit 8677867), at the gate: deleted src/lib/utils/csrf.ts, src/lib/utils/rbac.ts, src/lib/infrastructure/logger.ts, src/lib/infrastructure/error-monitoring.ts (barrel exports removed) and auth.service changePassword and deleteAccount. Modal.tsx stays for B6.

#### RENA-004 Temporary diagnostics endpoint on main

Severity P2. Status HELD (James-ordered). Batch B1 (no batch work: HELD). Overlap K.
Mechanism: src/app/api/shell/diag/route.ts: POST, no auth, 300 per minute per IP, 8 KiB body cap, console only, always 204; no caller on main; the beacons live in the Android preview bundles (3471da1) for the timing work.
Fix at closure, on James's word when the Android diagnostics close: delete the route; republish the preview channels from a bundle without PERF_JS and the beacon calls (STRING-LAW); record the closing commit here.
Delivery WEB plus preview OTA. Proof RIG-AUTO (route 404) plus the cooked-parse proof.
Last verified commit 766f98c. Decision owner and date: James (standing order, held). Overlap group K. Regression evidence: none yet.
Implementation status: HELD. D-ac (2026-10-07): deleted in the pre-closure code lane after B8 (the endpoint and its preview beacons; string law applies).

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
Last verified commit 766f98c (partial closure 623be47). Decision owner and date: James, 2026-10-06 (D-j). Overlap group A. Regression evidence: Rig: vitest src/lib/sw/sw.test.ts 11 of 11 on v6, 8 of 11 fail on the v5 file (the bench can fail); Playwright e2e/sw-isolation.spec.ts passes on the branch and fails on the main control build (6312a83).
Implementation status: BUILT (B2a on claude/b2a-sw-freshness-checkout, commit 8e350ab; e2e bac9577, 6411810). Changed: public/sw.js (v6), src/middleware.ts (NO_STORE_API_FAMILY for /api/cleaners, /api/job-check, /api/unsubscribe, unconditional per deviation (b)), next.config.js (/sw.js Cache-Control: no-cache), src/lib/sw/sw.test.ts, src/middleware.test.ts, e2e/sw-isolation.spec.ts. Install precaches /offline and its /\_next/static assets and never rejects over one asset (amendment 5). The test signs A in, browses, clears the session, signs B in, goes offline, and asserts no rena-dynamic cache, no /api entry, no A data. At the gate; the manual offline walk rides it. Not DONE until merged, deployed and walked. Earlier: TODO (B2).

#### RENA-055 Service-worker strategy more complex than the launch requirement

Severity P2. Status CONFIRMED. Batch B2. Overlap A.
Mechanism: nothing in src reads cached API data or navigator.onLine; web push has no browser subscriber; the offline page is the only feature the SW serves; PWA install works from the manifest alone.
Fix: delivered by RENA-048's v6 rewrite.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-j). Overlap group A. Regression evidence: As RENA-048.
Implementation status: BUILT with RENA-048 (B2a, commit 8e350ab). At the gate. Earlier: TODO (B2, with RENA-048).

#### RENA-018 Post-payment return to a stale Home

Severity P1. Status PARTIAL (worse than described). Batch B2. Overlap J.
Mechanism: customer Home fetches once in a mount-only effect (src/app/[locale]/app/home/page.tsx:80-118); the confirmation page's Done is a bare Link to /app/home (src/app/[locale]/booking-confirmation/[id]/page.tsx:311-315) which the shell turns into a silent tab switch with no page load (mobile-customer/App.tsx:1327-1332, nav.ts:30-36). There is no 30-second coalescing on the customer side (R17 touched Pro only). Home shows what it fetched at boot until a pull-to-refresh reloads it.
Fix: D-o. An invalidation contract: a page registers window.\_\_renaRefresh and listens to visibilitychange and pageshow with a short coalescing window (15 s); explicit invalidation overrides coalescing: booking, payment, cancel, reschedule and top-up mutations write a stale marker (sessionStorage rena:stale with the surface names) that Home and My Cleans honour immediately on activation regardless of the window; stale-while-revalidate so the pane paints at once. The Done link carries ?paid=<id> so a forwarded load also works when the pane is not mounted (lazy panes).
Migration or config: none.
Tests: Playwright toggles visibility and asserts a refetch; a stale marker triggers an immediate refetch inside the window. Manual: pay, Done, Home shows the clean, on a device.
Delivery WEB. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-o). Overlap group J. Regression evidence: Rig: vitest src/lib/freshness.test.ts 12 of 12; Playwright e2e/freshness.spec.ts (Done strips ?paid, no refetch inside the window, a marker refetches at once, a marker from another tab arrives by the storage event) passes on the branch and fails on the main control.
Implementation status: BUILT (B2a on claude/b2a-sw-freshness-checkout, commit cb0d601). Changed: src/lib/freshness.ts (per-pane localStorage keys rena:stale:<pane> for home, mycleans, account, cleaner; storage event; activation on visibilitychange, pageshow and focus with 15 s coalescing; explicit markers bypass it; markers expire after 60 minutes), app/home/page.tsx (load() registered, ?paid stripped by replaceState), account/bookings/page.tsx (load() registered, markers on confirm, cancel, dispute, review), booking-confirmation (markers when paid, Done to /app/home?paid=<id>), the mutation sites in booking/[id], approve-topup, regular-clean/[id] and the services wizard, AuthProvider (markers cleared on the authenticated to unauthenticated transition). Departures for the gate: the marker reset at sign out sits in AuthProvider once rather than at each caller; a shell logout that never reads unauthenticated in a pane leaves markers until their 60-minute expiry (harmless: a marker only forces a refetch). The device gate (James's walk) proves cross-WebView storage-event propagation on iOS and Android; if it fails, window.\_\_renaShow moves to B2b as a worded OTA (amendment 2). Not DONE until that walk. Earlier: TODO (B2).

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
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group I. Regression evidence: Ceremonial drive, branch against main 6312a83 on the rig, both roads (quote-first /services/regular, cleaner-first /book/[id] handing off to /services/regular?cleaner=) in guest and account mode: POST /api/bookings bodies identical field by field (14 of 14, all four cases); account return_url identical; guest return_url carries gt on the branch and lacked it on main; a paid guest booking rendered from the gt return reads Cleo is confirmed for your clean, while main's tokenless return gets four 401s and a generic Payment received. Vitest: callback-url 21, return-url 3. Playwright e2e/signup-callback.spec.ts.
Implementation status: BUILT (B2a on claude/b2a-sw-freshness-checkout, commits a44cab9, 3b066cf). Changed: src/lib/auth/callback-url.ts (one sanitiser, amendment 3) used by login and signup (signup gains callbackUrl), src/lib/booking/return-url.ts used by StripeCheckoutForm (gt whenever the server minted a token, whatever the mode), services/[category]/page.tsx (keeps the token from the POST response and passes it to checkout; the wizard keeps its inline sign-in as ruled). Register rule 20, source disproves part of this entry: the fork lives in book/[id]'s details step, and nothing has set step to details since d545e23 (2026-03-20), which replaced setStep('details') with router.push to /services/<type>?cleaner=<id>; the only reachable setStep is setStep('service') (book/[id]/page.tsx:1003). The fork changes built there were therefore reverted (3b066cf) rather than shipped to dead code. The live defect was the token: the wizard never passed it to checkout, so every website guest payment returned without gt. That is fixed and measured. Proposed register change for James: the fork half of RENA-020 recorded as disproved at d545e23; deleting the unreachable details step is parked (B6 dead-code sweep candidate). Earlier: TODO (B2).

#### RENA-021 Authenticated users still shown the fork

Severity P2. Status CONFIRMED. Batch B2. Overlap I.
Mechanism: book/[id]/page.tsx:1080 renders the fork on bookingMode === null only; isAuthenticated gates only convenience fetches; the customer shell sees the same fork.
Fix: delivered by RENA-020.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group I. Regression evidence: As RENA-020.
Implementation status: DISPROVED by source (register rule 20): the fork is unreachable since d545e23; the reachable road (the services wizard) derives guest-ness from the session and shows no fork. Proposed for James's ruling: close as disproved. Nothing built. Earlier: TODO (B2, with RENA-020).

#### RENA-023 /pay/[id] error screen has no action

Severity P2. Status CONFIRMED. Batch B2. Overlap B.
Mechanism: src/app/[locale]/pay/[id]/page.tsx:47-56 renders the heading and the error text with no link or button; any non-ok becomes the generic text; the server returns 404 "Not found" for a logged-out or wrong user (pay-intent/route.ts:40-46), so a logged-out customer sees "Pay for your clean" over "Not found".
Fix: error card with Try again and Back to booking; on 404 with no session and no token, a Sign in door with callbackUrl to the same /pay URL.
Migration or config: none.
Tests: Playwright: logged-out shows the sign-in door; wrong user shows Not found with Back; network error shows Try again. Manual: recurring charge email link while logged out.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group B. Regression evidence: Rig: Playwright e2e/pay-page.spec.ts (signed out shows the sign-in door carrying /pay/<id>; network failure offers Try again and the retry reaches the server; 500 and 403 each get their own state; a booking that is not theirs reads Not found with Back and Home) passes on the branch and fails on the main control.
Implementation status: BUILT (B2a on claude/b2a-sw-freshness-checkout, commit a44cab9). Changed: pay/[id]/page.tsx: failure kinds network, signin, notfound, forbidden, conflict, server, each with its own copy and door; signin applies to a 401, or a 404 with no session and no token (amendment 1: a 403 never touches the session). At the gate. Earlier: TODO (B2).

#### RENA-025 Customer freshness relies on manual full reloads

Severity P3. Status CONFIRMED. Batch B2. Overlap J.
Mechanism: src/app/[locale]/account/bookings/page.tsx:479-560 fetches once at mount; no refresh registration under /account or /app/home; the shell PTR calls location.reload() when none is registered (mobile-customer/App.tsx:1096).
Fix: delivered by RENA-018's contract on Home and My Cleans.
Delivery WEB. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: James, 2026-10-06 (D-o). Overlap group J. Regression evidence: As RENA-018.
Implementation status: BUILT with RENA-018 (B2a, commit cb0d601): My Cleans registers its load() and honours the markers. At the gate. Earlier: TODO (B2, with RENA-018).

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

#### RENA-084 Website: back to the dashboard from Messages misbehaves again

Severity P2. Status CONFIRMED (James-observed, James-ruled addition 2026-10-06). Batch B2. Web only. Overlap B.
Mechanism (reconciled against source at c4d5b86, 2026-10-06): the earlier back-from-messages fix (bf5baa6, July 2026) and its sweep still hold: every in-app link goes to the role home directly, /dashboard remains a legacy junction referenced only by the middleware protected list and robots.ts, and the shell-only back-chain backstop (256770f) fires under the customer shell UA alone. The regression is therefore not that fix undone; the source shows three paths the fix never covered. (1) Role-default race: src/app/[locale]/messages/page.tsx derives the back link from currentUserRole, a state that starts as 'customer' and flips only when the /api/auth/profile fetch resolves ok; a non-ok response leaves it 'customer' for the life of the page. The link is a plain next/link, not NavLink. The page shows the skeleton until the conversations fetch resolves, so the window is the gap between the two concurrent fetches, or the whole page life when the profile call fails. A cleaner in that window sees "Back to my account" and lands on /account, whose guard effect (src/app/[locale]/account/page.tsx, the isCleaner branch) calls router.push('/cleaner'), not replace. History then reads dashboard, /messages, /account, /cleaner: the browser back button returns to /account, which pushes /cleaner again, so back is trapped and the dashboard is reached only by a second gesture. The customer side mirrors it through the cleaner page's non-cleaner push to /account (src/app/[locale]/cleaner/page.tsx) should a customer ever land on /cleaner. (2) Phone-width thread view: while a conversation is open the list column, which carries the only back-to-dashboard link, is hidden (hidden md:block); the thread header chevron only closes the thread (state, no history entry), so a browser back from the thread leaves /messages altogether. (3) No pageshow or bfcache handling exists anywhere on the website (one popstate listener in the services booking wizard is the only history code outside the shell); a dashboard restored from the back-forward cache keeps the data it had before Messages was opened, so an unread badge or a new booking can read stale after back. D-o's invalidation contract (RENA-018) is specified for the /app routes only.
Fix: (1) derive the back link from the session the page already has (useAuth, the same source as the role-home guards) with no default route until the role is known, and make every role-home guard replace rather than push so a wrong landing never leaves a history entry; (2) keep the back-to-dashboard link reachable from the open thread on phone width; (3) extend D-o's pageshow handling to the website dashboards when B2 builds it. The exact scope is settled once James describes the symptom; nothing is built on inference.
Migration or config: none.
Tests: Playwright as a cleaner: open /messages, click the back link while the profile response is delayed, assert the landing is /cleaner with no /account history entry and that one browser back returns to Messages; as a customer the mirror; phone viewport: open a thread, assert the back link is reachable; pageshow: assert the dashboard refetches on a bfcache restore. Manual: James's symptom walk on the website before and after.
Delivery WEB. Proof RIG-AUTO plus James's walk.
Last verified commit c4d5b86. Decision owner and date: James, 2026-10-06. Overlap group B (session design and role-home guards); D is shell-only and does not apply. Regression evidence: Rig: Playwright e2e/messages-back.spec.ts, five tests: a cleaner's first way home is the cleaner's (fails on main with Back to my account), a customer is offered Back to my account, Back after a role redirect returns to Messages (fails on main, the customer was signed out), phone-width Back closes the thread, Forward reopens it with no duplicate entries, and direct entry with a booking shows the list on Back (both fail on main).
Implementation status: BUILT, mechanisms 1 and 2 (B2a on claude/b2a-sw-freshness-checkout, commits 0d820c4, 461e765). Changed: messages/page.tsx (role and id from useAuth, no way home until the role is known, the profile fetch removed; below 768 px opening a thread pushes one history entry namespaced as \_\_renaThread inside Next's own state, a popstate listener opens or closes it, the chevron spends the entry), account/page.tsx and cleaner/page.tsx (guards replace, never push), cleaner/layout.tsx (the profile fetch waits for an authenticated CLEANER session: its 401 branch used to sign out a customer who landed on /cleaner; departure named at the gate). Mechanism 3 (pageshow on the website dashboards) is B2b. James's symptom walk before and after stays the manual proof. Earlier: TODO (B2). D-ac (2026-10-07): all three mechanisms build in B2 (B2a builds mechanisms 1 and 2, B2b mechanism 3); D-aa's parking is superseded; James's symptom walk before and after stays the manual proof. Earlier, D-aa (2026-10-06): remains parked pending James's reproducible symptom (role, device, trapped versus wrong page versus stale), no fix guessed. Parked: James to describe the exact symptom on request (which role, which gesture: the in-page link, the browser back button or a swipe; phone or desktop width; whether the dashboard arrived stale or the wrong page arrived); overlap group B assumed from the ruling's wording, to be confirmed.

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

#### RENA-087 Top-up booking's anchored transfer slice can exceed its source charge

Severity P2 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N1, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: transfer.service.ts computes the anchored headroom from totalAmountCharged (:164), which includes top-up charges, but anchors every slice to the original stripeChargeId (:211-212); top-up charge ids are never stored and top-up PaymentIntents carry no transfer_group, so a top-up booking's anchored slice can exceed the original charge, Stripe rejects it and the booking goes FAILED with no automatic retry.
Fix: B4.2: TopupRecord.stripeChargeId stored; each charge (original and each succeeded top-up) gets its own ANCHORED slice up to that charge's amount; the remainder is one EXCESS slice.
Migration or config: TopupRecord.stripeChargeId (B4 migration).
Tests: B4.11 case 5 plus a top-up booking release producing one anchored slice per charge.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-088 Unknown-refund retry uses the original PaymentIntent and drops the allocation

Severity P2 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N2, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: refund.service.ts handleUnknownRefund retries with booking.stripePaymentIntentId (:418) rather than the slice's PaymentIntent used at :215, so a single slice that LIFO placed on a top-up PaymentIntent is retried with different parameters under the same idempotency key and Stripe returns an idempotency error; the retry success path writes no allocation (:425-436), so later allocations treat that refund as if it hit the original charge.
Fix: B4.3: every retry uses the slice's own PaymentIntent; slice rows replace the allocation JSON.
Migration or config: B4 migration.
Tests: B4.11 case 6 (connection error twice on a top-up slice, reconcile writes the truth).
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-089 Pre-release earnings scaling divides by totalPrice

Severity P2 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N3, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: writeRefundSuccess scales cleanerEarnings, platformFee, cleanerPayoutAmount and platformCommissionAmount by amount / totalPrice (refund.service.ts:776-777) while calculateCleanerSharePence uses totalAmountCharged, so the two disagree on top-up bookings.
Fix: B4.1 and B4.3: one formula, cleanerSharePence over chargedPence = round(totalAmountCharged × 100), for reversal and for scaling.
Migration or config: none.
Tests: B4.11 case 3 with earnings asserted after a partial pre-release refund on a top-up booking.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-090 Cascade-exhaustion auto refund ignores earlier refunds

Severity P2 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N4, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: cascade.service.ts autoRefundExhausted (:1708-1746, amount at :1725) and processExhaustedRefunds refund the full totalAmountCharged without subtracting earlier refunds, so on a PARTIALLY_REFUNDED booking the refund is refused by the ceiling guard on every five-minute sweep.
Fix: B4.3: remainingRefundablePence(booking) used for the exhaustion refund.
Migration or config: none.
Tests: an exhausted booking with an earlier partial refund refunds exactly the remainder once.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-091 Stuck-job remainder and retry-refund use totalPrice

Severity P2 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N5, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: stuck-jobs.service.ts cancelRefund computes the remainder from totalPrice (:355) and then forces transferStatus REFUNDED; POST /api/admin/bookings/retry-refund uses totalPrice (:72) and always the original PaymentIntent (:78), writes no allocation and no Xero push, and sets RELEASED on a partial refund (:88).
Fix: B4.3: remainingRefundablePence for the stuck-job remainder; retry-refund deleted, replaced by the stuck-money queue's actions (B4.6).
Migration or config: none.
Tests: a top-up booking's stuck-job cancel refunds the true remainder; the route answers 404.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-092 Dispute money failure strands the booking with the dispute RESOLVED

Severity P1 (James-confirmed 2026-10-07; part of RENA-013's mechanism). Status CONFIRMED (B4 survey addition N6, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: admin-operations.service.ts resolveDispute writes RESOLVED before the money step (:633-655) and the money step is best effort (:661-721); a failed refund restores transferStatus PAUSED, leaving the booking COMPLETED or CANCELLED, PAUSED, with a RESOLVED dispute; nothing re-resolves it and the scheduler picks PENDING only.
Fix: B4.4: RESOLVING_REFUND and RESOLVING_RELEASE, RESOLVED only on confirmed money movement, retryResolvingDisputes with retry and backoff metadata per D-ac, the row visible in stuck-money.
Migration or config: the DisputeStatus enum values and Dispute columns (B4 migration).
Tests: B4.11 case 7.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4, with RENA-013).

#### RENA-093 Stripe chargebacks never pause release

Severity P1 (James-ruled 2026-10-07, raised from the proposed P2: the chargeback hold is money integrity). Status CONFIRMED (B4 survey addition N7, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: webhooks/stripe/route.ts handles charge.dispute.created with an alert email only (:375-411) and funds_withdrawn and funds_reinstated with Xero pushes only (:420-456); neither pauses release nor touches the booking.
Fix (D-ac): unreleased funds get a chargeback hold; a chargeback after release becomes CHARGEBACK_AFTER_RELEASE in stuck-money; release resumes only when moneyHoldReasons(booking) is empty (dispute, shortfall and chargeback holds coexist).
Migration or config: the hold representation is specified in the B4 build (B4 migration).
Tests: chargeback before release holds; closed or reinstated with another hold still present keeps the hold; after release lands in stuck-money.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-094 Reference seed resets admin-managed PlatformConfig on every deploy

Severity P3 (James-confirmed 2026-10-07). Status CONFIRMED (B4 survey addition N8, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: prisma/seed-reference-data.ts upserts PlatformConfig rows with update: { value, description } (:205), so every deploy overwrites admin edits.
Fix (D-ac): admin-managed PlatformConfig defaults are create-if-missing, never reset on deploy; the misleading fee controls removed (RENA-075).
Migration or config: seed change.
Tests: a seeded key edited by admin survives a seed re-run; a missing key is created.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

#### RENA-095 Recurring off-session charge treats an unknown outcome as a failed attempt

Severity P1 (James-confirmed 2026-10-07; a possible double charge). Status CONFIRMED (B4 survey addition N9, ruled in by D-ac). Batch B4. Overlap F.
Mechanism: recurring-charge.service.ts catches a StripeConnectionError on the off-session charge as a failure (:183-187), although the card may have been charged; a later attempt under a new key could charge twice.
Fix (D-ac): a deterministic stored idempotency key, one same-key retry, then UNKNOWN reconciled by the sweep; never a new-key replacement charge while UNKNOWN.
Migration or config: the stored key and attempt state (B4 migration).
Tests: connection error twice leaves UNKNOWN and no second charge; the sweep reconciles to succeeded or failed by the stored key.
Delivery WEB, full diff review. Proof RIG-AUTO.
Last verified commit 7f54ec5. Decision owner and date: James, 2026-10-07 (D-ac). Overlap group F. Regression evidence: none yet.
Implementation status: TODO (B4).

### B5 Native shell OTA lane

#### RENA-022 Customer deep-link resolver cannot open nested routes

Severity P2. Status PARTIAL (real, dormant until customer push activates). Batch B5 (customer OTA, dormant until the customer push activation word). Overlap C.
Mechanism: mobile-customer/nav.ts:12-22 matches only the five tab roots; App.tsx:284-298 forwards only absolute URLs on BASE*URL with a query or hash; customer notification URLs are relative (/booking/<id>, /booking/<id>/approve-topup, /pay/<id>, /messages?bookingId=) and are bell rows; customer push is gated off (App.tsx:87). Through applyLink every one resolves to null or a bare switch.
Fix: the shared resolver (C): absolutise relative URLs against BASE_URL; map nested same-origin paths to an owning tab (/booking/* and /pay/\_ to mycleans, /messages* to messages, /cleaners/* to cleaners) and forward the full URL through externalNav; read the cold-start notification response once at boot.
Migration or config: none.
Tests: pure resolver table in nav.ts (RIG-AUTO). Manual: one tap per notification type once customer push is activated.
Delivery OTA (customer), in the same OTA as RENA-037. Proof RIG-PARTIAL + DEVICE.
Last verified commit 766f98c. Decision owner and date: none needed. Overlap group C. Regression evidence: none yet.
Implementation status: TODO (B5 OTA). D-ac (2026-10-07): customer push activates in B5, PUSH_ACTIVATED flipping true in the same OTA as this resolver and the notification rationale card; the C7 hold is lifted at that point and recorded as James's decision; until then it stays off because taps cannot yet route.

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

Severity P1 (raised 2026-10-06, D-aa: the recruitment week). Status CONFIRMED. Batch B5 (handoff UX; the token-mint half delivered in B1a). Overlap M.
James's fresh observation (2026-10-06): the in-app cleaner signup still lands in the website shell and then kicks the cleaner out; the R12 checklist homepage did not cure it because the native handoff after web signup never happens.
Mechanism: join/page.tsx:1533-1538 router.push('/cleaner') unconditionally after sign-in; mobile/App.tsx:929-946 JoinScreen is a full-screen WebView in the logged-out phase with no onSessionLost, onBridged or tab props, so onNav never reacts; no bridge message for join exists; the shell stays in phase join with the website dashboard inside it and no Bearer stored.
Fix: shell-gated branch on the join page: after the final submit navigate to /app/joined?email=...; JoinScreen gains onJoined(email); the shell switches to the login phase with the email prefilled and the line "Your application is in. Sign in to continue."; native login mints the Bearer and bridges to Today. Website behaviour unchanged.
Migration or config: none.
Tests: rig: in-shell UA join completes to /app/joined; website UA lands on /cleaner. Manual: the walk on a device.
Delivery WEB plus Pro OTA. Proof RIG-PARTIAL + DEVICE.
Last verified commit 7fd9f92,. Decision owner and date: James, 2026-10-06 (D-aa, D-x). Overlap group M. Regression evidence: none yet for the handoff.
Implementation status: SPLIT. B1a (commit 7fd9f92,) updated the token-mint paths: /api/auth/signup and /api/auth/login mint a BEARER DeviceSession row and a bridge code naming it, so the handoff consumes one primitive. B5 builds the wizard-to-native handoff UX for both apps as one design with RENA-082.

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

Severity P1 (raised 2026-10-06, D-aa: the recruitment week). Status CONFIRMED (James-ruled addition). Batch B5 (handoff UX for both apps as one design with RENA-031; the token-mint half delivered in B1a). Overlap M.
James's fresh observation (2026-10-06, with RENA-031): the in-app signup still lands in the website shell and then kicks the user out; the native handoff after web signup never happens.
Mechanism: the customer shell opens /en/signup in a dedicated SignupScreen WebView in the logged-out phase (mobile-customer/App.tsx:522, 892-909) with no onSessionLost, onBridged or tab props, so the shell's navigation watcher never reacts; the web signup page auto-signs the new account in and pushes /account (src/app/[locale]/signup/page.tsx:90-101), the website portal, inside that WebView. No native token is minted and the shell never enters the tabbed phase: the tab bar is absent, the user is forced to back out and log in again. Observed on device.
Expected: signup completes the native handoff exactly as login does (native token minted, bridge redeemed, panes landing signed in) and the customer lands on Home with the verify-email banner at the top.
Fix: designed together with RENA-031 as one handoff for both shells (overlap M). Shell-gated branch on the signup page: after a successful signup navigate to a shell-recognised completion URL carrying the email; SignupScreen gains an onSignedUp(email) prop; the shell performs the native login with the just-created credentials (or receives a one-time bridge code from the signup response, the mechanism to be reconciled against source in the batch), stores the Bearer, bridges to /app/home and shows the verify-email banner. Website behaviour unchanged (incognito diff).
Migration or config: none expected; a bridge-code return on the signup response is a server change if chosen.
Tests: rig: in-shell UA signup reaches the completion URL and the native login path; website UA lands on /account unchanged. Manual: the device walk, signup to Home with the banner, tab bar present. Proof RIG-PARTIAL + DEVICE.
Delivery WEB plus customer OTA.
Last verified commit 7fd9f92,. Decision owner and date: James, 2026-10-06 (D-aa, D-x). Overlap group M. Regression evidence: none yet for the handoff.
Implementation status: SPLIT. B1a (commit 7fd9f92,) updated the signup token-mint path (BEARER row plus a bridge code naming it); B5 builds the handoff UX for both apps as one design with RENA-031.

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
Tests: a check that the build manifest marks the marketing routes static or ISR; Playwright incognito diff of the 26 baselined public routes. Manual: none.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (all 26 baselined public routes; every affected route named before implementation).
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

#### RENA-086 App-only strings live in components, not a localisation module

Severity P3. Status CONFIRMED (James-ruled addition, D-ab). Batch B6. Overlap none.
Mechanism: the in-shell consent ask (src/components/app/ShellConsentSheet.tsx) and the analytics choice (src/components/app/AnalyticsChoice.tsx) carry English strings in the component because messages/en.json is serialised into every public page through NextIntlClientProvider, so adding keys there would change every public route's served payload.
Fix: a shell and app-only localisation module (its own message file and provider mounted only under app and shell surfaces) receives these strings and future app-only strings. Never back into the public-page translation payload.
Migration or config: none.
Tests: the hash tool shows all 26 baselined public routes unchanged; the app surfaces render the same text.
Delivery WEB. Proof RIG-AUTO. HASH-LAW (proof of no change).
Last verified commit 843b7b5. Decision owner and date: James, 2026-10-06 (D-ab). Overlap group none. Regression evidence: none yet.
Implementation status: TODO (B6).

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

No new entries. Per D-ac, B9 is pure closure with no product code; RENA-004 and RENA-007 step two move to the pre-closure code lane and RENA-001 step two to N15, both before B9, so they no longer sit on the later-phase list below. B9 runs the required final regression matrix (section 8) end to end, confirms every entry's regression evidence field is filled, records the closing commit on each entry, and declares the hardening programme complete only when every entry is RESOLVED, CLOSED, DECISION or an explicitly deferred later-phase item. Later-phase items carried into B9 for confirmation: RENA-001 step two (Next 15), RENA-005 step three (CSP enforcement), RENA-007 step two (device list), RENA-041 JS half (optional per D-c), RENA-052 (after measurement), RENA-056 (second locale), RENA-067 later half (per-document keys), RENA-078 (stale push comments, with RENA-046).

#### RENA-085 Remaining console calls carry inline disables instead of the structured logger

Severity P3. Status CONFIRMED (James-ruled addition, D-ab). Batch B7. Overlap K.
Mechanism: after B1b, 183 console calls in src/lib and src/app/api keep inline eslint-disable comments and pass the no-console rule; none carries a payload per the log-hygiene grep, but they bypass the allowlist, the redactor and the JSON line format.
Fix: migrate each onto src/lib/log.ts with allowlisted fields, then make the rule refuse inline disables in those folders so src/lib/log.ts is the only exception in fact. The scheduler summary line keeps a form the seven-day watch and the register read.
Migration or config: none.
Tests: the count of inline no-console disables in src/lib and src/app/api reaches zero (a CI check); the log-hygiene grep stays clean.
Delivery WEB. Proof RIG-AUTO.
Last verified commit 127d0a5. Decision owner and date: James, 2026-10-06 (D-ab). Overlap group K. Regression evidence: none yet.
Implementation status: TODO (B7).

## 8. Required final regression matrix

Customer: signup, login, logout, password reset; authenticated booking; guest booking and guest recovery; Stripe success, decline, 3DS, cancel, abandoned; confirmation to Done to Home and My Cleans showing the new booking; cancellation and refund; app killed and reopened during and after payment; session expiry inside each main tab; account switch never shows prior account data; offline, network and 5xx never shown as a genuine empty state; nested push and deep links route correctly.

Cleaner: application to native handoff; Stripe Connect incomplete and complete return; offer push to the exact offer screen; pre-accept API contains no protected customer details; two simultaneous overlapping accepts, exactly one wins; non-overlapping accepts both work; offer expiry enforced server-side; EN_ROUTE, IN_PROGRESS and COMPLETED windows enforced; cancellation and dispute races cannot resurrect stale state; session expiry returns the shell to login; completion to release and dispute pathways.

Money: duplicate webhooks; cancel versus success race; original charge plus top-up partial and full refunds; refund slice failure and retry; split-transfer payout then refund and reversal; unknown Stripe outcome reconciliation; dispute refund and release failure and retry; scheduler duplicate trigger is harmless; stuck-money operations expose every abnormal state; add-on payout at the parent rate.

Mobile: Android A37 and A24 clean install, login, force close, cold restart; account switching; iOS equivalent; renderer and content-process death recovery; external-link policy; statement download origin tests; lazy pane construction and deep-link construction; splash on Android 12 and later release build; native crash telemetry receives a controlled event; OTA and runtime compatibility check.

Privacy and operations: no consent means zero analytics sends, web and in-app; service worker never serves one account's data to another; health returns 503 with the database unavailable; scheduler heartbeat endpoint returns 503 when stale; exactly one effective scheduler execution per tick; retention fixtures hit each rule; deletion SLA monitoring works; export wording matches contents and the SAR process is documented; backups and one restore drill documented; store declarations match the product.

## 9. Change log

- 2026-10-07: B2a BUILT on claude/b2a-sw-freshness-checkout (commits 8e350ab, cb0d601, a44cab9, 0d820c4, 3b066cf, 461e765, bac9577, 6411810): RENA-048 and 055 (service worker v6), RENA-018 and 025 (the freshness contract), RENA-020 and 023 (callback sanitiser, guest token on every return_url, honest pay page), RENA-084 mechanisms 1 and 2. Register rule 20: RENA-020's fork half and RENA-021 disproved by source (the book/[id] details step unreachable since d545e23); changes there reverted, register change proposed for James. Ceremonial money-path drive against main 6312a83: payloads identical, the guest return gains gt. All 26 governed routes hash identical. At the gate; no merge until James's word.
- 2026-10-07: STEP 0 merged to main 6312a83 on James's word. Severities of RENA-087 to RENA-095 confirmed as proposed except RENA-093 raised to P1 (the chargeback hold is money integrity). The governed route set grows with the routes as built: 28 at B5, 30 at B8, each gate adding its routes to docs/public-routes.json, CLAUDE.md and the baselines together. The two labelled notes in docs/design/B6.md and B9.md stand as the record of the programme order superseding the design reports. B2a begins.
- 2026-10-07: STEP 0 of the hardening programme (docs only): the nine design reports (B2 to B9) committed verbatim in docs/design with James's rulings and amendments; D-ac recorded (every named deviation approved; order B2a, B2b, B3, B4, B5, B6, B7, B8, the pre-closure code lane, N15, B9; the business-rule rulings; customer push activates in B5 and the C7 hold lifts then); RENA-087 to RENA-095 added under B4 (the survey additions N1 to N9, severities proposed for confirmation); RENA-084 builds all three mechanisms in B2; RENA-004 and RENA-007 step two moved to the pre-closure lane; RENA-001 step two is N15; the governed public route set ruled at 30. No code change.
- 2026-10-07: B1 CLOSED. B1a DEPLOYED and DONE (0165dd3, deployment dda67793, James's walk passed on both apps and the website, both lanes); B1b merged ec445c9 and DEPLOYED (deployment 5bb35e2e, boot clean, /privacy verified live); RENA-002's retraction recorded; the revert branch retired. RENA-066 and 077 reach DONE on the first production line read and James's signup walk.
- 2026-10-07: three externals recorded on James's word: NEXTAUTH_URL confirmed present as a build-visible service variable (RENA-006, RENA-002's D-y canonical origin); LOG_HMAC_KEY set in Railway (RENA-066, D-ab); the Cloudflare range snapshot diffed against the live cloudflare.com/ips lists and found identical, 15 IPv4 and 7 IPv6 (RENA-002). No code change.
- 2026-10-06: B1b rulings D-ab recorded: deviation 3 rebuilt (an unconfigured provider in production is a failure; signup says so with a retry), privacy page dated 6 October 2026, hash law moved to the 26 baselined public routes with one canonical list (docs/public-routes.json, CLAUDE.md, the hash tool and CI), every 21 in this register corrected, RENA-085 (B7) and RENA-086 (B6) added. B1b held at the gate until James's B1a walk passes.
- 2026-10-06: B1b BUILT on claude/b1b-privacy-telemetry (commits 127d0a5, 843b7b5, 17f73d1, 8677867): RENA-066 and 077 logging, RENA-059 consent gate, RENA-001 dependency patches, RENA-079 dead code, RENA-009 recorded. At the gate; no merge until James's B1a walk passes and his word.
- 2026-10-06: B1a BUILT on claude/b1a-session-core (commits 7fd9f92, 70ee97b, bccbfae and 8a52215): D-g session architecture with the parent validity and hierarchy laws, the grandfather cutoff, every mint and revoke path, one client IP chooser, the CSRF rule; rulings D-r to D-aa recorded; RENA-002 mechanism corrected (TRUSTED_PROXY cloudflare, domain proxied); RENA-031 and 082 raised to P1 and split; RENA-068 parked until the B1b telemetry lands; RENA-084 parked pending the symptom. At the gate, no merge.
- 2026-10-06: RENA-068 ruled DONE (verified via production dashboard, rig run not required). RENA-084 added (website back to the dashboard from Messages, James-observed, P2, B2, overlap B) with the mechanism reconciled against source at c4d5b86; nothing built.
- 2026-10-06: B0 CLOSED. D-e step two proven (UptimeRobot scheduler monitor alerted on the deliberate stale test, main health monitor unaffected), step three executed (Railway schedule restored 18:49 UTC, cron-job.org PAUSED), single-caller ticks confirmed from Railway alone (18:50:52 and 18:55:45 UTC, one summary each, no skips) and the heartbeat healed to 200 healthy; the seven-day watch (step four) started; RENA-081 and RENA-014 updated; RENA-068's Sentry verification stays James-side.
- 2026-10-06: B0 Gate B merged (fd5f75f) and deployed (b303fabb); RENA-014 (with 062) recorded DONE for the code half with production evidence; RENA-081 carries the James-side steps.
- 2026-10-06: B0 Gate A merged (6026a97) and deployed (8545a5b9); entries 069, 061, 042, 035 (static test) and 068 (script) updated with commits and evidence; 014 recorded as built and awaiting the word.
- 2026-10-06: RENA-082 (customer in-shell signup handoff, B5, overlap M with RENA-031) and RENA-083 (build-time Google Fonts fetch, B6, P3) added, James-ruled, nothing built.
- 2026-10-06: batches reordered to the auditor's final order on James's review (B0 governance, CI and decisions; B1 authentication, sessions and privacy boundary; B2 service worker and customer recovery; B3 cleaner lifecycle and concurrency; B4 money ledger; B5 native shell OTA lane; B6 web platform; B7 scheduler, operations and GDPR; B8 native rebuild; B9 full regression and closure), with 014 and 061 pulled forward into B0.
- 2026-10-06: register created from the independent audit, the P1 challenge, the reconciliation report and James's rulings D-a to D-q with the auditor's amendments adopted. Last verified commit for all entries: 766f98c (ac917eb and e8076b3 for the two held lanes).
