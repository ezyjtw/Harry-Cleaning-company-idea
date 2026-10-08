# Push activation runbook (stub — walked when launch reaches it)

C7 push activation is ARMED, not fired. It fires only on James's explicit
activation word. This stub holds everything moved out of the campaign
handover's §8 ledger (James, 30 Sep 2026) so the activation gate has one
door.

## The switch

- Correction (B5, 8 Oct 2026): the Pro shell has no `PUSH_ACTIVATED` flag.
  Pro push was activated in the 1.0.1 cargo (C7 word spent for that build).
  The flag exists only in `mobile-customer/App.tsx`, and B5 Customer-5 flips
  it to `true` per James's ruling. It stays the customer kill switch.
- B5.8 (RENA-046), both shells: the OS permission is asked only after the
  rationale card is answered "Turn on", once per install
  (`rena.pro.pushAsked`, `rena.customer.pushAsked`). Granted registers the
  token silently via `registerToken()`; a page posting
  `{type: 'pushSettings'}` opens the settings door (re-ask, else system
  Settings). Decisions are `pushEntryDecision` and `pushDoorDecision` in
  each shell's `nav.ts`.
- Flipping it is pure shell JS ⇒ ships **OTA** (`eas update --channel
production`) against the current runtimes — no store build needed.
- FCM v1 service-account key: uploaded by James directly to both Expo
  projects. It lives ONLY in EAS credentials and never enters this repo.
- `EXPO_ACCESS_TOKEN` (server, optional): unset ⇒ Expo push still sends;
  only needed if the Expo project enforces enhanced push security.

## iOS provisional-auth note (moved from §8)

iOS provisional authorization delivers quietly to Notification Centre
without a permission prompt and WITHOUT badging. Decision owed at this
gate: request full authorization (prompt, badge-capable) or start
provisional and upgrade later. The permission-ask moment in each shell is
the single ask James ruled — do not add a second ask when resolving this.

## Device-test steps (the activation gate's UAT)

1. Flip `PUSH_ACTIVATED` in ONE shell first (Pro), OTA to production.
2. On a real device: fresh install → shell entry → the single permission
   ask appears once; accept.
3. `DeviceToken` row appears for the account (admin check).
4. Fire a real offer push (cascade offer to that cleaner) — arrives with
   the app foregrounded, backgrounded, and killed.
5. Quiet-hours law: confirm deferred sends still defer (job-processor's
   quiet-hours handling is server-side and unaffected by the flag).
6. Repeat 1-5 for the customer shell (money-release push is its live lane).
7. Only then: both shells' flags true in the repo, one gated commit, OTA
   both channels, boot-line watch as standing.

Rollback: OTA republish of the prior update group (restore points recorded
per release in the session log).
