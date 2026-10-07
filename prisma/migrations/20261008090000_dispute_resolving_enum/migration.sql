-- B4 (RENA-013, RENA-092): the dispute money step's in-flight states.
-- Its own migration, ordered first: an enum value added in a transaction
-- cannot be used inside that same transaction.
ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'RESOLVING_REFUND';
ALTER TYPE "DisputeStatus" ADD VALUE IF NOT EXISTS 'RESOLVING_RELEASE';
