-- B6 (D-ad, second auditor condition 1, James-ruled 23 Oct): expand only.
-- FixedServicePrice.customerPrice is dormant: no code reads or writes it, and
-- the seed no longer supplies it, so the column may no longer be NOT NULL.
-- Every existing value stays. The physical drop (and the deletion of the four
-- dormant multiplier PlatformConfig rows) is its own contraction gate after
-- the B6 deploy is healthy; pre-B6 code stays a safe rollback until then.
ALTER TABLE "FixedServicePrice" ALTER COLUMN "customerPrice" DROP NOT NULL;
