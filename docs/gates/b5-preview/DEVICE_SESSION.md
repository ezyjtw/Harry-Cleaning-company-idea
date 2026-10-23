# End of run device session: one run sheet (James's batch run, 23 Oct, item 6)

Everything here runs against staging
(https://rena-web-staging-staging.up.railway.app) on the PREVIEW channel.
Nothing touches production. The pieces stay unpublished to production; the
production publish words come only after this session.

How a step is written: what you do, what you should see, and the failure to
look for. Where the sources do not state an expected result, the step says
OPEN POINT instead of a guess; the full list is at the end.

How the channel moves: you never edit EAS yourself. When a step says
"repoint", tell me the branch and I run, for that app:

    cd mobile            (Rena Pro)    or    cd mobile-customer    (RENA)
    npx -y eas-cli@16 channel:edit preview --branch <branch> --non-interactive

then reply "repointed". After every repoint: fully close the app, open it,
wait 10 seconds, close it, open it again (expo-updates downloads on the first
launch and applies on the second). On the timing twins I confirm from the
staging log that the device is on the expected update group before you
start. The clean piece builds carry no beacon (OPEN POINT 1).

## 0. Prerequisites

1. Android: the Rena Pro and RENA preview binaries installed (they exist).
2. iOS: the Rena Pro 1.0.3 and RENA 1.0.1 internal preview builds installed
   from the links I send. BLOCKED today on your Apple signing step: run
   `cd mobile && npx eas-cli build -p ios --profile preview` and the same in
   `mobile-customer` interactively (Apple login), or give me an App Store
   Connect API key (.p8, key id, issuer id) as secrets and I build them.
3. Staging seeded: needs your word on the Q1 seed gate. I then seed
   SEED_MODE=base and send you the three logins (staging-cleaner,
   staging-customer, staging-admin, all @integration.invalid) with the
   staging seed password I sent.
4. Staging Stripe test keys set on staging (a word you owe): needed for the
   checkout with 3DS walk and the Pro Connect round trip.
5. For the throttled walks: iOS Settings, Developer, Network Link
   Conditioner, Very Bad Network (enable Developer mode on the iPhone). On
   Android a physical device has no built in throttle (OPEN POINT 9).
6. Synthetic applicant and signup emails of your choosing, never a sweep
   exempt person. Write each one in the grid as you use it so I can clear
   them from staging afterwards.
7. A live offer push needs a staging redeploy with SEED_MODE=offer (30
   minute offer) or offer-expiring (90 second offer); each one is a Railway
   change I announce and make, taking a few minutes. The cleaner must be
   signed in on the device first so its push token is registered.

## Sitting 1: Android (about 3 hours)

### 1A. The timing walk (twins)

The two twins differ from their clean commits only by the timing marks
(named in their commits): twin-baseline is 2a9255c (what Android production
serves) plus marks; twin-pieces is 77e0af2 (Pro-1 and Customer-1) plus
marks. Every navigation posts one 'nav' record to /api/shell/diag: T0 tap,
T1 pane shown, T2 document load start, T4 load end, T5 'dressed' received,
T6 veil fade start, T7 veil gone, plus the page's own marks. I read them back
from the staging log and fill the table.

1. Repoint both apps to twin-baseline (already there today). Relaunch twice.
   I confirm the update group from the 'bundle' beacon.
2. Rena Pro, signed in as staging-cleaner. Do each of these five times,
   waiting until the page is fully shown each time: cold launch to Today;
   tap each tab once from Today (first visit, cold pane); tap each tab again
   (warm pane); one cross tab link from Today into another tab. Tell me when
   done; I note the time window.
3. RENA, signed in as staging-customer: the same set (cold launch to Home,
   each tab cold, each tab warm, one cross tab link).
4. Repoint both apps to twin-pieces. Relaunch twice. I confirm the group.
5. Repeat steps 2 and 3 exactly, same device, same network, same order.
6. I publish the table: per tap type, median and worst of T0 to T5 and T0
   to T7, baseline against pieces. Pass: no added cost (the five run count
   is my proposal, OPEN POINT 2).

Failure to look for: a tap that sits on the veil about 6 seconds (the long
stop, flagged "+ls" in the record): that is the dressed observer dying, the
piece-1 family. Stop and tell me.

### 1B. Rena Pro, piece by piece

Pieces are cumulative: each one carries every earlier piece.

Pro-1 (repoint Rena Pro to preview-pro-1):
1. Offer push, foreground: with the app open on Today, I seed an offer.
   Tap the push. Expect the Offer room for that offer.
2. Offer push, background: app in the background, I seed an offer, tap it.
   Expect the Offer room.
3. Offer push, terminated: swipe the app away, I seed an offer, tap it.
   Expect the app to open straight into the Offer room, once (cold start
   read once).
4. Expired offer: I seed offer-expiring (90 seconds). Wait two minutes,
   tap. Expect the Offer room's expired state.
5. Logout clears a parked forward (792f878): log out, log back in. Expect
   Today, and no jump into the earlier offer.
Failure to look for: landing on Today root instead of the Offer room; the
same offer opening twice; a push opening a page outside the app.

Pro-2 (preview-pro-2):
1. Statement download (RENA-036): Earnings, download the statement. Expect
   the share sheet with the PDF (OPEN POINT 3: the seed may hold no
   statement).
2. Stripe Connect round trip (RENA-024): start Stripe onboarding from the
   cleaner Stripe page. Expect Stripe in the pane and a clean return to the
   app. Needs the staging Stripe keys.
3. A mailto or tel link (support or a customer phone): expect the OS mail
   or dialler app.
4. Any outside https link: expect the system browser, not the pane.
5. The dispute evidence link opens the browser (OPEN POINT 4: needs a
   dispute on staging).
Failure to look for: an outside site loading inside the app; Stripe opening
in the browser mid Connect; "Download failed" on the real statement.

Pro-3 (preview-pro-3):
1. Session lost: I revoke the cleaner's session server side (OPEN POINT 5:
   the method on staging). Expect native login within two poll ticks (the
   rule is two 401s at least 5 seconds apart within 3 minutes; a 401 brings
   the next tick forward to 15 seconds, so under a minute).
2. Airplane mode for one minute on Today, then back. Expect no logout.
3. Log out from the app. Log in on the website as the same cleaner: the
   app's device session is gone (OPEN POINT 6: how you would see it).
Failure to look for: a logout on a network blip; no logout after revocation.

Pro-4 handoff walks, on preview-pro-4-final (OPEN POINT 7: why not
preview-pro-4). Use docs/gates/pre-ota-handoff/ota-device-walks.md, walks 1
to 5, with these additions:
1. Capable success: logged out, Join, every step, Submit. Expect "Your
   application is in. Signing you in", then Today with the finish card gone;
   native login never shows. Note seconds from Submit to Today.
2. Slow redemption: throttled (OPEN POINT 9 on Android). Expect the shell to
   stay in REDEEMING past the page's 10 second net, then Today.
3. Failure or expiry: airplane mode right after Submit. Expect native login,
   email prefilled, "Your account is ready. Sign in to continue."; signing
   in lands on Today.
4. No handoff at all, the forced failure (D-aj item 4): OPEN POINT 8 (staging
   has no switch to force the mint to fail). Expected per the walk doc:
   native login, email prefilled.
5. A second attempt starts afresh: log out, Join with a new applicant, as
   walk 1.
6. Redemption timeout measurement (D-aj item 3): ten timed runs normal, ten
   throttled, recording signedUp to answer (OPEN POINT 10: no mark carries
   this time in the clean build). From the numbers I propose the timeout
   value for your ruling, then a throttled run past it must show walk 3's
   outcome.
Failure to look for: native login during REDEEMING; the device left on a
WebView "Signing you in" screen; a second attempt carrying the first
attempt's state.

Pro-5 (preview-pro-5), needs a fresh install state: Settings, Apps, Rena
Pro, Storage, Clear data, then open, close, open (back on the update).
1. Sign in. Expect the notification rationale card before any OS prompt.
2. Turn on: expect the OS prompt; allow. Expect no card again on relaunch.
3. Clear data again, decline at the card (OPEN POINT 11: the expected
   wording and later behaviour of "not now").
4. The settings door (a page posting pushSettings): expect a re ask, or
   system Settings when denied. OPEN POINT 12: no page carries it yet.
5. Repeat one offer push tap (foreground) to show push still lands.
Failure to look for: the OS prompt before the card; the card on every
launch.

### 1C. RENA, piece by piece

Customer-1 (preview-customer-1): push is off in this piece, so only the
non push items. OPEN POINT 13: the sources give no walk for Customer-1
without push; its notification taps are owed at Customer-5.

Customer-2 (preview-customer-2):
1. Test mode checkout with 3DS (RENA-024): book a clean as
   staging-customer, pay with a Stripe 3DS test card. Expect Elements and
   the 3DS challenge inside the app and a clean return to the booking.
2. A mailto or tel link: OS app. An outside https link: system browser.
Failure to look for: the 3DS frame blank or bounced to the browser; payment
left pending.

Customer-3 (preview-customer-3):
1. Session lost: I revoke the customer's session (OPEN POINT 5). The
   customer shell has no probe (deviation 1): expect the next page load to
   hit B2's 401 door and the shell to go to native login.
2. Airplane blip: no logout.

Customer-4 handoff walks on preview-customer-4-final, walks 1 to 6 as Pro-4
(signup instead of join; success lands on Home with the verify email
banner; the forced failure and the timing measurement carry the same open
points 8 and 10).

Customer-5 (preview-customer-5), fresh install state (clear data):
1. Rationale card, Turn on, OS prompt, as Pro-5.
2. The settings door on the customer Account page (D-ae): expect re ask or
   system Settings. OPEN POINT 14: no page carries the door yet.
3. The notification tap walk owed from Customer-1: one tap per customer
   notification type, each foreground, background and terminated: a booking
   (/booking/<id>, expect My cleans on that booking), a top up approval
   (/booking/<id>/approve-topup), a payment (/pay/<id>), a message
   (/messages?bookingId=, expect Messages on that thread). OPEN POINT 15:
   how each is fired on staging (the seed only makes cleaner offer pushes).
Failure to look for: a tap landing on the tab root; the cold start tap
applied twice.

### 1D. Final regression on Android

Repoint both apps to preview-pro-4-final and preview-customer-4-final (the
shells equal main 930cfa7, every piece together). One pass: an offer push
tap, a statement download, one outside link, the capable join and signup
success, one notification tap per app. Expect every earlier result again.

## Sitting 2: iOS (about 3 hours, after the internal builds exist)

1. The timing walk, 1A steps 1 to 6 on the iPhone. OPEN POINT 16: the
   baseline twin is built on 2a9255c, while iOS production serves c1ae429.
2. Rena Pro pieces, 1B in order, plus Pro-2 item 6 below.
3. RENA pieces, 1C in order, plus Customer-2 item 3 below.
4. The final regression, 1D.

Pro-2 item 6 and Customer-2 item 3, the injection timing proof (D-ae, STRING
LAW): onOpenWindow is iOS only (Android sets setSupportMultipleWindows
false), so this proof lives in this sitting. A link that opens a new window
inside the pane runs the locationAssignScript injection; the proof is the
dressed arrival table for that navigation against the baseline. OPEN POINT
17: no twin carries Pro-2 or Customer-2 (twin-pieces is 77e0af2, before the
injection), so the table needs a third twin on 74a6afb with marks, and
OPEN POINT 18: which in pane link opens a new window on staging.

Pro-4 and Customer-4 throttled walks use the Network Link Conditioner here.

## Results grid

Fill one cell per run: P pass, F fail with a word on what you saw, or the
seconds where the step asks for time.

| Step | Pro Android | Pro iOS | RENA Android | RENA iOS |
|---|---|---|---|---|
| Timing walk baseline done | | | | |
| Timing walk pieces done | | | | |
| P1.1 offer push foreground | | | | |
| P1.2 offer push background | | | | |
| P1.3 offer push terminated | | | | |
| P1.4 expired offer | | | | |
| P1.5 logout clears forward | | | | |
| P2.1 statement download | | | | |
| P2.2 Connect round trip | | | | |
| P2.3 mailto or tel | | | | |
| P2.4 outside link to browser | | | | |
| P2.5 dispute link | | | | |
| P2.6 injection timing (iOS) | | | | |
| P3.1 revocation to login | | | | |
| P3.2 blip, no logout | | | | |
| C2.1 checkout with 3DS | | | | |
| C2.2 mailto, tel, outside link | | | | |
| C2.3 injection timing (iOS) | | | | |
| C3.1 revocation to login | | | | |
| C3.2 blip, no logout | | | | |
| 4.1 capable success, seconds | | | | |
| 4.2 slow redemption | | | | |
| 4.3 failure or expiry | | | | |
| 4.4 forced failure | | | | |
| 4.5 second attempt | | | | |
| 4.6 timeout runs, normal x10 | | | | |
| 4.6 timeout runs, throttled x10 | | | | |
| 4.6 past timeout to FAILED | | | | |
| 5.1 card before OS prompt | | | | |
| 5.2 Turn on, no card again | | | | |
| 5.3 not now | | | | |
| 5.4 settings door | | | | |
| C5.3 booking tap, fg bg term | | | | |
| C5.3 top up tap, fg bg term | | | | |
| C5.3 pay tap, fg bg term | | | | |
| C5.3 message tap, fg bg term | | | | |
| Final regression pass | | | | |

Emails used: ____________________________

## Open points (named, not guessed)

1. The clean piece builds carry no identity beacon, so after a repoint only
   behaviour shows which piece is running. A visible update id or a beacon
   would need a shell change.
2. Run counts for the timing walk (five per tap type) are my proposal; the
   sources set none for tabs.
3. Whether staging's seeded cleaner has a statement to download.
4. No dispute exists on staging for the dispute evidence link walk.
5. How to revoke a session server side on staging (the signed in devices UI
   is RENA-007 step two, not built); a direct database update needs your
   word as a staging data change.
6. How the Pro-3 logout revocation (D-w) is observed from the device.
7. preview-pro-4 and preview-customer-4 (5c63713) predate the capability
   token (e066f3b), and staging's web posts the handoff only to a capable
   shell, so on those branches the handoff behaves as a legacy shell. The
   handoff walks therefore run on the 4-final branches. Pro-5 (958f34c) and
   Customer-5 (1814367) also predate the token: confirm which commit each
   production publish is cut from.
8. The forced failure (D-aj item 4): staging has no switch to make the
   handoff mint fail; it needs a temporary staging only build or a staging
   config change, on your word.
9. Android throttling on a physical phone: no built in conditioner; the
   walk doc names the emulator. Choose a method (a throttled hotspot, or
   the emulator for this walk only).
10. The redemption time (signedUp to answer) has no mark in the clean
    4-final builds; measuring it on the device needs a timing twin of
    5b4ae89, or the staging log's server side redeem time if you accept
    that as the measure.
11. The expected wording and later behaviour of the rationale card's
    decline.
12. No web page posts pushSettings, on 1814367 or on main 930cfa7 (git grep
    over src finds none): the shells listen for the settings door, but no
    page opens it yet, in Pro or in the customer app. Walk 5.4 cannot run
    until a page carries the door.
13. Customer-1 has no stated device walk apart from the push taps owed at
    Customer-5.
14. The customer Account settings door (D-ae) is not on the Account page at
    1814367 or main (see point 12); the register says it rides Customer-5.
    It needs building and its own gate before Customer-5 C5.2 can pass.
15. How each customer notification type is fired on staging; the seed only
    makes cleaner offer pushes.
16. The iOS baseline: twin-baseline is 2a9255c; iOS production serves
    c1ae429.
17. The Pro-2 and Customer-2 injection timing proof needs a twin on 74a6afb
    (named marks only), published to the preview channel on your word.
18. Which in pane link on staging opens a new window, to exercise
    onOpenWindow.
19. The redemption measurement asks for ten runs per condition per app per
    platform: about 80 fresh applicants and signups in all. Say if fewer
    runs, or one platform, will do.
