# Pro-4 and Customer-4 OTA gate: device walks (D-ah item 5, D-ai item 5)

Owed at each shell's own OTA gate, on a real device, before any publication.
Neither piece is published until the pre-OTA handoff gate (RENA-103 and the
handoff redemption state) has passed and James names the piece.

Each walk uses a synthetic applicant (an address James chooses, never a
sweep-exempt person). Record per step: what the screen showed, and the time
from final submit to the next screen.

## Pro-4 (join)

1. **Capable success.** Logged out, Join, complete all steps, Submit.
   Expect "Your application is in. Signing you in", then the authenticated
   shell on Today with the finish card gone. The native login screen never
   appears.
2. **Slow redemption (no premature fallback).** Throttle the device network
   (iOS Network Link Conditioner, Very Bad Network; Android emulator network
   speed GPRS) so the redemption takes longer than 10 seconds. Submit. The
   page's safety net moves the WebView to /cleaner at about 10 seconds;
   expect the shell to stay in REDEEMING (no native login screen) and then
   enter the authenticated shell when the redemption answers.
3. **Failure or expiry.** Submit, then cut the network (airplane mode) before
   the redemption answers. Expect native login with the email prefilled and
   "Your account is ready. Sign in to continue." Signing in lands on Today.
4. **No handoff at all (D-ah item 5).** A submit whose handoff code is not
   minted: final submit committed, no handoff message, the page goes to
   /cleaner, the shell recognises the portal landing, native login with the
   email prefilled. How to force the mint failure on a device is PARKED for
   James (production cannot be made to fail without a write; candidates: a
   preview-channel build pointed at a rig server).
5. **A second attempt starts afresh.** After walk 3, log out, Join again with
   a new applicant: the flow behaves as walk 1 (the state starts from IDLE).

## Customer-4 (signup)

1. **Capable success.** Logged out, Create account, submit. Expect "Your
   account is ready. Signing you in", then Home with the verify-email
   banner. The native login screen never appears.
2. **Slow redemption.** As Pro-4 walk 2: the page's net finishes the website
   sign in at about 10 seconds; expect the shell to stay in REDEEMING and
   then land on Home.
3. **Failure or expiry.** As Pro-4 walk 3: native login with the email
   prefilled; signing in lands on Home.
4. **No handoff at all.** As Pro-4 walk 4 for signup (the page completes on
   the website account path; the shell recognises the portal landing; native
   login with the email prefilled). Forcing method PARKED as above.
5. **A second attempt starts afresh.** As Pro-4 walk 5.

## Pass condition

Every walk shows its expected screen, the native login screen appears only
in walks 3 and 4, and no walk leaves the device on a WebView "Signing you
in" screen.
