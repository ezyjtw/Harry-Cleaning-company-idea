-- READ-ONLY pre-flight for the #4 coverage gate.
-- Answers one question: does merging #4 hide any cleaner that is live TODAY?
--
-- Where to run it:
--   Railway dashboard -> your Postgres service -> "Data" (or "Query") tab
--   -> paste the whole block below -> Run. It only SELECTs; it writes nothing.
--
-- How to read the result (single row, three numbers):
--   total_profiles        = every CleanerProfile row.
--   grid_eligible_now      = would show in the grid under the OLD gate
--                            (verified + Stripe charges + Stripe payouts + active
--                             user + valid insurance).
--   newly_excluded_by_gate = of those grid-eligible, how many have NULL geo
--                            (latitude/longitude) OR NULL maxTravelMinutes, i.e.
--                            the ones #4 would newly hide.
--
-- Decision:
--   newly_excluded_by_gate = 0  -> #4 hides nothing real -> safe to merge, no backfill.
--   newly_excluded_by_gate > 0  -> those are real live cleaners at risk ->
--                                  run scripts/backfill-cleaner-geo.ts first.

SELECT
  (SELECT COUNT(*) FROM "CleanerProfile") AS total_profiles,

  COUNT(*) FILTER (
    WHERE cp.verified = true
      AND cp."stripeChargesEnabled" = true
      AND cp."stripePayoutsEnabled" = true
      AND u."accountStatus" = 'ACTIVE'
      AND u."isDeleted" = false
      AND (cp."insuranceExpiresAt" IS NULL OR cp."insuranceExpiresAt" > now())
  ) AS grid_eligible_now,

  COUNT(*) FILTER (
    WHERE cp.verified = true
      AND cp."stripeChargesEnabled" = true
      AND cp."stripePayoutsEnabled" = true
      AND u."accountStatus" = 'ACTIVE'
      AND u."isDeleted" = false
      AND (cp."insuranceExpiresAt" IS NULL OR cp."insuranceExpiresAt" > now())
      AND (cp.latitude IS NULL OR cp.longitude IS NULL OR cp."maxTravelMinutes" IS NULL)
  ) AS newly_excluded_by_gate

FROM "CleanerProfile" cp
JOIN "User" u ON u.id = cp."userId";

-- Optional: if newly_excluded_by_gate > 0, list exactly who (so you can eyeball
-- whether they're real). Uncomment to run.
--
-- SELECT u.email, u.name, cp.postcode, cp.latitude, cp.longitude, cp."maxTravelMinutes"
-- FROM "CleanerProfile" cp
-- JOIN "User" u ON u.id = cp."userId"
-- WHERE cp.verified = true
--   AND cp."stripeChargesEnabled" = true
--   AND cp."stripePayoutsEnabled" = true
--   AND u."accountStatus" = 'ACTIVE'
--   AND u."isDeleted" = false
--   AND (cp."insuranceExpiresAt" IS NULL OR cp."insuranceExpiresAt" > now())
--   AND (cp.latitude IS NULL OR cp.longitude IS NULL OR cp."maxTravelMinutes" IS NULL);
