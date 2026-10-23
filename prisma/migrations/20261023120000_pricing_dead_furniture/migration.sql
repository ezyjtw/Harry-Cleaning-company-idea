-- B6 (D-ad, James-ruled 2026-10-07): the pricing dead furniture.
-- FixedServicePrice.customerPrice was never read for money (prices are each
-- cleaner's own); estimatedHours stays as the calendar hold (LB-6).
ALTER TABLE "FixedServicePrice" DROP COLUMN "customerPrice";

-- The four multiplier keys were inert (cleaner-set rates, no multipliers).
-- The seed is create-if-missing, so the rows persist until deleted here.
DELETE FROM "PlatformConfig"
WHERE "key" IN ('same_day_multiplier', 'one_off_multiplier', 'fortnightly_multiplier', 'deep_multiplier');
