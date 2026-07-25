-- F6a: never-paid bookings get their own terminal species. The enum value was
-- added to schema.prisma before the migrate-deploy cutover (3947c85) landed,
-- so it needs this migration to reach databases managed by `migrate deploy`.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
