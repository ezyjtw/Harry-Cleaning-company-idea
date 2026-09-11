# Rena (customer app shell)

The native customer shell — sibling of `mobile/` (Rena Pro), seeded from it
under the Phase 1 fork ruling (option a: sibling folder; shared-core
extraction ledgered for when a third divergence bites).

- Bundle: `uk.co.renacleaning.app` · display name **Rena** · scheme `rena`
- UA suffix: `RenaApp/<version>` · header: `x-rena-shell: app-ios/<build>`
- Five tabs: Home (`/account` placeholder) · My Cleans (`/account/bookings`) ·
  raised BOOK (`/services`) · Cleaners (`/cleaners`) · Messages (`/messages`)
- Push: entitlement present, activation GATED (`PUSH_ACTIVATED = false`) —
  the C7 law carried over. No camera string (customers take no job photos).
- Version-bump law from day one: `runtimeVersion` = `appVersion`, so any
  native change bumps `version` and cuts a fresh build before OTA.
- EAS project: NOT yet created — waits on the asset-approval word
  (`updates.url` + `extra.eas.projectId` land with it).

Run: `npm ci && npx expo start` (from this directory).
