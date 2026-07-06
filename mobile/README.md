# Rena Pro — native shell (Expo)

The cleaner app: a native tab bar + Face ID + push wrapping the Rena web app, with
two purpose-built screens (Today, Offer) served from the web at `/app/*`. This is
the **P1 shell scaffold** — it runs against the live web app (`baseUrl` in
`app.json`). It has **not** been built/run in CI; the steps below are what turns it
into a TestFlight build on your phone.

Bundle ID (both platforms): **`uk.co.renacleaning.pro`**

---

## How the auth flow works (so the steps make sense)
1. You sign in on the **native login screen** → it POSTs to `/api/auth/login`.
2. The response returns a 30-day **Bearer token** (stored in the iOS Keychain via
   `expo-secure-store`) **and** a single-use, 60-second **bridgeCode**.
3. The first WebView loads `/api/auth/session-bridge?code=<bridgeCode>` once — the
   server mints a NextAuth **session cookie** in the WebView. Every tab (Today +
   the portal routes) shares that cookie, so the whole app is signed in.
4. On every cold open, **Face ID** unlocks the app (the cookie persists between
   launches). If the web session ever expires, the app bounces back to the native
   login screen.

Nothing here needs a server change — the web side (bridge, `/app/*`, shell
detection) is already live on `main`.

---

## Expo Go quick-start (fastest loop — no build needed)
This is the quickest way to see the shell on your phone while iterating. It runs
the JS in the **Expo Go** app (App Store / Play Store) — no EAS build, no Apple
account needed.

```bash
cd mobile
npm install
npx expo start          # a QR code appears in the terminal
```
- **iOS:** open the **Camera** app, point at the QR → "Open in Expo Go".
- **Android:** open **Expo Go** → "Scan QR code".

By default the WebViews load the **live** web app (`expo.extra.baseUrl` =
`https://www.renacleaning.co.uk`), so sign-in → Today → Offer all work immediately.

**Works in Expo Go:** the tab bar, all five WebViews (Today + portal routes),
native login → the session-bridge cookie flow, pull-to-refresh, the offline state.

**Needs the EAS dev/prod build (not reliable in Go):**
- **Face ID** — `expo-local-authentication` runs in Go, but Go supplies its own
  generic permission prompt (our branded `NSFaceIDUsageDescription` from the
  config plugin only applies in an EAS build), and behaviour is only guaranteed
  in a standalone build.
- **Push** — not implemented until P2, and Expo Go can't receive push tokens
  anyway; needs an EAS dev/prod build.
- **Cookie persistence across cold starts** — Go uses its own WebView container,
  so the bridged session cookie may not survive a Go restart the way it does in a
  standalone build with a persistent `WKWebsiteDataStore`. Expect to re-login in
  Go more often; the real build persists it.

**Pointing the WebViews at a LOCAL web dev server** (to test unreleased web
changes): set `expo.extra.baseUrl` in `app.json` to your **Mac's LAN IP**, not
`localhost` — on the phone, `localhost` means the phone itself.
```jsonc
// app.json → expo.extra
"baseUrl": "http://192.168.1.42:3000"   // your Mac's LAN IP (System Settings → Wi-Fi → Details)
```
Then run the web app so it binds to the LAN, with the phone on the **same Wi-Fi**:
```bash
# in the web repo root
npm run dev -- -H 0.0.0.0        # Next.js listens on all interfaces
```
Set `baseUrl` back to the production URL before building for TestFlight. (Local
HTTP works in Go; a production build needs HTTPS for the secure session cookie.)

---

## What YOU (James) do vs what's automated
| Step | Who |
|---|---|
| Create Expo account, run EAS commands | You (one-time), then repeatable |
| Apple Developer Program membership ($99/yr) | **You** — only you can |
| Create the App Store Connect app record + register the bundle ID | **You** (click-by-click below) |
| Google Play Console app ($25 one-time) | **You** |
| APNs key for push (P2 only) | **You** (later) |
| Icon/splash art | Design (1024px Etna wordmark on ink-navy `#16296b`) |
| The build itself, signing, upload | **EAS** (automated once credentials are connected) |

I can't run any of this in the dev sandbox (no Apple/Google credentials, no
device) — that's why it's your handoff.

---

## One-time local setup
```bash
cd mobile
npm install
npm i -g eas-cli          # or: npx eas-cli@latest
eas login                 # sign into your Expo account
eas init                  # creates the EAS project → copy the printed projectId
```
Paste the `projectId` into `app.json` → `expo.extra.eas.projectId`.

Add the three art assets to `mobile/assets/` (any 1024×1024 PNG works to start):
`icon.png`, `splash.png`, `adaptive-icon.png`.

---

## Apple — App Store Connect (click-by-click)
1. **developer.apple.com/account** → enroll in the **Apple Developer Program** if
   you haven't ($99/yr). You need the **Account Holder** or **Admin** role.
2. **Certificates, Identifiers & Profiles → Identifiers → +** → **App IDs → App**
   → Description: "Rena Pro" → Bundle ID: **Explicit** → `uk.co.renacleaning.pro`
   → (leave capabilities default for P1; you'll add **Push Notifications** in P2)
   → **Register**.
3. **appstoreconnect.apple.com → Apps → +　→ New App** → Platform: iOS → Name:
   "Rena Pro" → Primary language: English (UK) → Bundle ID: pick
   `uk.co.renacleaning.pro` → SKU: `rena-pro` → **Create**.
4. That's all that's needed before the first build. (Screenshots/描述 come in P4.)

## Google — Play Console
1. **play.google.com/console** → pay the $25 one-time fee if new.
2. **Create app** → Name "Rena Pro" → default language English (UK) → App → Free
   → create. The `applicationId` `uk.co.renacleaning.pro` is set by `app.json`.
3. For automated EAS submit later: **Setup → API access** → create a **service
   account** → download its JSON key (you'll point EAS at it in P4).

---

## Build to your phone (TestFlight)
From `mobile/`:
```bash
# First iOS build — EAS will prompt to create signing credentials for you.
# Choose "Let EAS handle it" for the distribution certificate + provisioning profile.
eas build --platform ios --profile preview

# When it finishes, upload to TestFlight:
eas submit --platform ios --latest
```
Then in **App Store Connect → your app → TestFlight**, add yourself as an internal
tester and install via the **TestFlight** app on your phone. That build is the
**P1 gate**: sign in → see your real jobs on **Today** → open an **Offer** →
Accept/Decline end-to-end.

Android internal track (optional in P1):
```bash
eas build --platform android --profile preview
# install the .apk/.aab EAS gives you, or submit to the internal track
```

Local iterate without a full build (fastest loop):
```bash
npx expo start        # open in Expo Go / a dev client; loads against the live web app
```

---

## P2 (push) — what you'll add then, not now
- Apple: **Identifiers → your App ID → enable Push Notifications**, then
  **Keys → + → Apple Push Notifications service (APNs)** → download the `.p8` →
  `eas credentials` to attach it (EAS stores it; you upload once).
- Android: EAS wires FCM automatically via the Expo push service; you just enable
  it. The server already has the `EXPO_PUSH` channel design (Phase 0 §3) — the
  `DeviceToken` model + registration endpoint land in P2.

---

## Config reference
- `app.json` → `expo.extra.baseUrl` — the web app the shell wraps (defaults to
  `https://www.renacleaning.co.uk`). Point at a staging URL to test against staging.
- The shell identifies itself to the web with header `x-rena-shell: pro-ios/<ver>`
  and UA suffix `RenaPro/<ver>` (the web hides its marketing chrome and serves
  `/app/*` only to the shell on the strength of these).
