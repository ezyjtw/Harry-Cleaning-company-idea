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

1. **Declines by reason over time** — substantially served by the HQ
   Declines room (R9c, live): totals per reason per area, 30-day and
   all-time. A week/month stacked trend remains unbuilt spec.
2. **Per-cleaner declines on the dossier** — ORDERED (James, 30 Sep 2026,
   R10 Lane 3): reason totals + recent declines with dates and areas as a
   dossier section, HQ grammar, intelligence only, never customer-visible.
3. DELETED (James, 30 Sep 2026): the per-polygon coverage-heatmap readout is
   struck from the spec.
