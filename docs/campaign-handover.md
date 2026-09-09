# Campaign handover — instructions to the next session

You are picking up a live production system (Rena Cleaning Network) mid-campaign,
working for James under a binding working method. Read `CLAUDE.md` first — the
gate workflow, leak-proofing law, settled rulings, and Railway/migration rules
there are law and are not repeated in full here. This document is everything
else: how this seat actually operates, where every workstream stands as of
**7 Sep 2026**, and what is armed and waiting.

---

## 1. The gate discipline (how you work — non-negotiable)

- **Build on a session branch, never on main.** One proven thing per commit.
  "Proven" means you drove it — Playwright against seeded fixtures for UI,
  quoted command output for everything else — before you report it.
- **Every commit gets a gate report**: a plain-text checklist, per item stating
  what changed, how to test it, and whether verifying needs a WEB-refresh or a
  TUNNEL-restart. Then you **WAIT for James's explicit word** on that specific
  commit hash. No merge on inference, silence, or "looks done". Words are
  per-commit; a word on one hash authorizes exactly that hash.
- **Merge alone**: `git merge --no-ff <hash>` on main, push, then watch the
  Railway deploy green and **quote the boot-check lines** back — migrations
  line ("No pending migrations to apply." / applied list), the
  `[seed-reference-data]` sync line, and `✓ Ready in Nms`. A deploy is not done
  until you have quoted these. Then deliver the **UAT list** (CLAUDE.md
  defines its required shape — tied to the actual diff, never generic).
- **Money-touching or data-deleting code** (payments, payouts, refunds,
  cascade, fees, anything deleting/overwriting records): James gets a **full
  diff review** before the word, not just a checklist.
- **Visual changes**: screenshot-by-description — text renderings of what the
  screen shows. Attach actual images ONLY when James explicitly asks on a
  specific item (they slow his relays badly).
- **Ambiguities are parked, never guessed.** The parked list ships with every
  gate report, even when empty ("Parked: nothing").
- **Disclosure at action time**: if you improvise, deviate, or discover you
  did something outside the word, say so in the same message as the action —
  and revert improvisations unless ruled otherwise. This includes disclosing
  your own errors unprompted (branch slips, duplicate merges, claims you
  couldn't actually observe). James accepts corrections well and treats
  self-applied rigor as the standard; hiding anything is the only fatal move.
- **Loud both ways**: failures reported with the actual output, successes
  stated plainly without hedging. Never claim something you did not observe
  (e.g. "ran prompt-free" when you cannot see prompts — that exact claim was
  made and retracted once; don't repeat it).
- **The Railway `railway-agent` tool's answers are claims, not facts** (James's
  standing ruling — it once falsely claimed "no redeploy" during a live
  deploy). Corroborate everything it says with the direct read tools.
- Commit attribution: end every commit with the co-author + session trailers
  the harness supplies. Never put a model identifier in commits, PRs, code, or
  docs.
- Do not relitigate the settled rulings in CLAUDE.md (net-first earnings, 6%
  fee placement, cleaner-set rates, light theme, brand fonts, guest tokens,
  catchment fails open, naming).

## 2. The visual standard — "the approved Earnings mockup"

Every cleaner-facing app screen (L2, `/app/*`) is judged against the approved
Earnings mockup. Its traits, which James cites by name when ruling:

- **Serif money**: figures in Newsreader (`font-newsreader`), large and calm
  (hero at 40px).
- **Tracking-caps labels**: `text-[11px] font-semibold uppercase
tracking-[0.16em]` eyebrows, never headline-shouting.
- **Breathing room**: rounded-2xl cards, generous padding, divide-y lists.
- **Plain-English status lines**: "Review window ends ~Wednesday", "Paid
  Sat, 5 Sept — usually reaches your bank in a few working days". Sentences,
  not badge soup.
- **Initial-avatars**: initials circles (`bg-page ring-1 ring-line`), no
  photos, **no shouty pills**.
- **Teal is reserved for money-in-motion** (`border-teal-600/25 bg-teal-600/5
text-teal-700`); navy `bg-primary` for hero cards. All-caps in copy reads
  as shouting to James — title case (the "Rena Pro" casing ruling).
- Reference implementation: `src/app/[locale]/app/earnings/page.tsx` (W7).

## 3. Where the app workstream stands (7 Sep 2026, end of day)

**The App Walk (W1–W8) is complete and live.** All merged to main and deployed
green today: W6 + W7 as separate gates, then W1–W5 as one batch, W8 was
ruled no-change. R1 (EAS linkage) also merged. Main tip after today:
`d4625c7` (Merge R1) ← `9259252` (W1–W5) ← `89267c9` (W7) ← `2c0246f` (W6).

- **EAS project**: `b62e3a93-8175-42dd-b1b9-dc7d657856d0`, owner `harryw84`,
  name on expo.dev "RENA Pro". `mobile/app.json` is linked to it (R1). **Never
  create another EAS project.** Note: this remote environment's network policy
  **403-blocks api.expo.dev**, so `eas` CLI cannot run from here — Expo work
  happens on James's side or a machine with access. A previously supplied Expo
  token was deleted and revoked; there is no Expo credential anywhere in this
  repo or environment, and none should ever be committed or logged.
- **Next step on the app**: James's B2 Apple Developer enrollment, then the
  first iOS build — `eas build --profile preview --platform ios` from
  `mobile/` — to TestFlight. Everything web-side ships OTA already (L2 screens
  are just deployed web routes).
- **Push**: server side fully built and dormant (DeviceToken model,
  register/deregister routes, `queueExpoPush` no-ops without tokens;
  `EXPO_ACCESS_TOKEN` optional). The C7 binary is capable-dormant
  (entitlements, background mode, expo-notifications plugin, deep-link
  resolver, badge sync — **no permission prompt anywhere**). **Activation is a
  separate explicit word**: ~40 lines app-side + a TestFlight build. Do not
  activate on inference.
- **James's UAT lap is outstanding on his phone**: the Gate 1 dossier checks
  (Paused-exemption line; rows still alive past their original sweep dates),
  the Gate 2 W6 time-off drive, and the W7 + W1–W5 UAT list delivered 7 Sep.
  Expect findings; treat each as a fresh gate item.

## 4. Store pack and submission blockers

`mobile/store-pack.md` is the source of truth. State: app name **"Rena Pro"**
(title case everywhere the store displays it — settled), privacy answers
declare the push token **now** (option (a) — the binary is push-capable even
while dormant), splash re-exported at 1284×2778 (verified), and the reviewer
plan is a **staged family account ("Charlie")** — no seed script. Staging is
owned by this seat and fires **only on James's pre-submission word**: 2 fresh
today-jobs + 1 live offer created immediately before submission.

Blockers cleared 8 Sep 2026: (1) Apple Developer enrollment — **DONE** (James,
Organization team A6B9BGJQR5); (2) first TestFlight build — **DONE** (EAS
production build 6, id `b758f0c2-4338-4a98-95cb-e7971eeccd4a`, uploaded to
TestFlight and processing on Apple's side). Remaining, in order: (3)
real-device screenshots for the listing — now unblocked, capture once build 6
finishes processing; (4) reviewer staging on the word; (5) submission.

## 5. Standing checks (armed — do not disarm without a word)

- **Monday sweep Routine** `trig_011pfHXBcpRKSMrqscyt1Sr4`, cron `0 8 * * 1`,
  self-binds to the running session. Body: `list-tcp-proxies` on Postgres-lIPQ
  (service `1d217a34-2a5b-4e25-a033-b1dc4c6c3467`) — **expect empty**. Why:
  the postgres-ssl template's Sunday vuln-autoupdate window (00:00–18:00 UTC)
  has resurrected proxies before (hayabusa:42494, deleted by James 30 Jul;
  sakura:21590, deleted on his word 3 Sep). Riders on the same firing: the
  web service's `multiRegionConfig` must be **europe-west4-drams3a only** (a
  us-west2 replica once appeared uninvited), plus `environment-status`. In a
  scheduled context you report findings — **never delete without a word**.
  First firing 7 Sep: all clear. Also standing: after ANY database-service
  redeploy or config commit, re-verify the proxy list is empty.
- **The same ruling in prose**: no TCP proxy on the new database — private
  networking only, ever.

## 6. Environment facts

- **Railway**: project `e0baa411-9ec2-412a-aafb-f8f1ce122ad8`, web service
  `19f2a2ce-2eab-488f-ac09-59cbc3bbc866`, environment
  `dbbb7fb5-c780-4eb9-9a96-4c9b646f56a3`, database **Postgres-lIPQ**
  `1d217a34-2a5b-4e25-a033-b1dc4c6c3467` in **europe-west4 (Amsterdam)**,
  private networking only (`postgres-lipq.railway.internal:5432`), no public
  proxy, `DATABASE_PUBLIC_URL` deliberately deleted. PITR continuous + daily
  backups verified by James 3 Sep. Migrations run via `prisma migrate deploy`
  on start (see CLAUDE.md — every schema change needs a committed migration;
  `db push` is banned in prod).
- **Permissions**: `.claude/settings.local.json` carries 21 `mcp__Raila__*`
  read allow-rules (mirrored at `/root/.claude/settings.json`).
  **`list-variables` is deliberately excluded** — it returns secret values.
  Settings load at session start only; mid-session writes don't take effect.
  Writes/destructive Railway operations stay gated on James, always.
- **Boot warnings that are normal**: `[Boot] Optional environment variable
not set` for SMTP_USER/SMTP_PASSWORD/REDIS_URL/EXPO_ACCESS_TOKEN/
  XERO_ALLOW_TEST_PUSH. Anything else in boot is a finding.
- **Local dev**: postgres at `PGPASSWORD=rena psql -h 127.0.0.1 -U rena -d
rena`; dev server via a scratchpad `start-dev.sh` (nohup; dummy env; arg
  `failmail` sets `EMAIL_FORCE_FAIL=1`); Playwright with
  `executablePath: '/opt/pw-browsers/chromium'`; fixtures
  `admin@test.local/AdminPass!234` and `complete.test@example.com/
CleanerPass!23` (Cora, has a profile). **The cookie-consent banner
  intercepts clicks in fresh browser contexts — dismiss it first**; it has
  produced two false drive failures already.
- **This remote environment**: network policy blocks api.expo.dev (see §3);
  GitHub via MCP tools only; anything worth keeping must be committed and
  pushed before the container is reclaimed.

## 7. The two live cleaner leads (handle with care — real people)

Both are real incomplete signups James intends to phone. Both are **exempt
from the 30-day incomplete-signup sweep** via `SWEEP_EXEMPT_EMAILS` in
`src/lib/services/incomplete-signup.service.ts` (James's ruling: "until I
confirm I've called them"; everything else sweeps normally):

- **Corina Macoveanu** — `macoveanu_cory@yahoo.com`. Her original sweep clock
  would have run out Friday 12 Sep 19:36 UTC; the exemption paused it.
- **Frankie Bull** — `cleanandrefine@gmail.com`.

Their admin dossiers (F28) live at `/admin/cleaners/[id]` — account state,
verify-link expiry, furthest wizard step with timestamps, docs honesty, an
"Auto-removal: Paused — exempt from the sweep" line, and a resend-verification
button. **Un-exempting = deleting the email from `SWEEP_EXEMPT_EMAILS` — only
on James's explicit word after he confirms contact.** The exported broom stays.

## 8. Parked / ledgered (recorded, NOT built — with reasons)

- **W3 collapse-weeks-beyond-next** on /app/jobs — parked until real cleaners
  hold 15+ upcoming jobs, or anyone asks for a shorter list (trigger recorded
  in-code at the divider site).
- **6h repeat-customer release window as marketing ammunition** — ledgered on
  James's word; copy exists nowhere yet.
- **iOS provisional-auth badge note** — noted for the push-activation gate.
- **G4 regulars-windows** — deferred-until-pulled by real usage.
- **G7 week navigation** — nice-to-have, unscheduled.
- **L3-chasing** (polishing wrapped portal pages) — **rejected**, don't propose.
- **Ops decline-reason readouts** — specced in `docs/ops-dashboard-spec.md`,
  build waits on a ruling; the reasons are intelligence only, **no automatic
  behaviour ever** (ruled), and the stored vocabulary (`too_far`, `bad_time`,
  `pay_too_low`, `other`) is stable.
- **C7 push activation** and **reviewer staging** — armed, each on its own
  explicit word (§3, §4).
- **Native chat rebuild for Messages** — out of scope; Messages stays the
  wrapped web page (in-shell skin only). Pulled when real usage demands it
  (James-ruled, App Review Batch 1).
- **"Copy to weekdays"** — retired with the P2 drag-slider sheet. Re-addable
  if setting the week day-by-day proves tedious in practice (James-ruled,
  App Review Batch 1).
- **Wheel alternative (horizontal chip-strip time picker)** — unbuilt,
  awaiting James's on-device verdict on the native drums. No change without
  his word (P2.5 #8).
- **Platform question, outside the app batch**: `availableNow` drives a public
  "Available now" badge + sort on the cleaner directory while same-day booking
  is "coming soon" — should a badge advertising an unoffered capability exist
  at all? For another day, under the website's own rules (James, P2.5).
- **Real support-thread mechanism** (staff user + Message-schema work or a
  SupportThread model + admin reply tooling) — pulled-when-real-usage-demands,
  same shelf as the native chat rebuild. Contact Rena ships on the existing
  /api/contact intake instead (James-ruled, P3).
- **/join in-shell intro screen** — if the F29 funnel ever shows the intro
  screen bleeding applicants, deleting it (straight to Step 1) is the ruled
  fallback (James, P3 wizard shape B).
- **NSCameraUsageDescription** — the proper camera fix, ledgered NOT built:
  add to `mobile/app.json` infoPlist with the exact string "Rena Pro uses the
  camera to take your profile and job photos." as part of the NEXT native
  build, whenever one happens — version-bump law applies (1.0.0 → 1.0.1), no
  dedicated TestFlight round trip for this alone. Un-gate the in-shell
  camera-path controls (cleaner/profile + /join profile photo) in the same
  release. Until then: camera controls hidden in-shell where a library
  sibling exists; the /join H97 selfie and both /verify steps stay
  capture-only (crash-on-tap on the current binary — accepted pending
  James's word on those steps); the native file-sheet's own camera row is
  not suppressible web-side (James-accepted, library-only in-shell).
- **Jo/Pete incident** — closed permanently by James; drop it from ledgers.

## 9. First moves for a fresh session

1. Read `CLAUDE.md`, then this file, then `mobile/store-pack.md` and
   `docs/ops-dashboard-spec.md`.
2. Check main's latest deploy is green and quote yourself the boot lines.
3. Check whether the Monday Routine has fired since last session; act on
   findings report-only.
4. Ask James nothing you can verify yourself; park what you can't.
