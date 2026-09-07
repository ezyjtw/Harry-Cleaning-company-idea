# Ops dashboard — spec (accumulating)

Spec only — nothing here is built until James rules a build. Readouts are added
here as rulings create them.

## Decline-reason readouts (W5, James-ruled 7 Sep 2026)

Source of truth: `Booking.declineReasons` — a JSON list of
`{ cleanerId, reason, at }` appended by `/api/cleaner/jobs/[id]/decline`.
Vocabulary (stable, stored values): `too_far` · `bad_time` · `pay_too_low` ·
`other`. Reasons are optional (declines record without one), and the customer
never sees them in any form. **Intelligence only — no automatic behaviour is
ever built on these** (ruled).

1. **Declines by reason over time** — aggregate: stacked count per reason per
   week/month, platform-wide. Answers "why are offers dying?" as a trend.
2. **Per-cleaner declines on the dossier** — the admin cleaner dossier gains a
   reason breakdown for that cleaner's declines (count per reason, recent
   list). Answers "is this cleaner declining on distance or on pay?"
3. **Per-polygon declines feeding the coverage heatmap** — declines joined to
   the booking's geocoded point, bucketed by catchment polygon / area, with
   `too_far` weighted as the coverage signal. Answers "where does the network
   say no?"
