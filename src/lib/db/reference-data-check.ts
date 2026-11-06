import prisma from '@/lib/db/prisma';
import { log } from '@/lib/log';

class ReferenceDataMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferenceDataMissingError';
  }
}

let integrityCheckPromise: Promise<void> | null = null;

export async function checkReferenceDataIntegrity(): Promise<void> {
  if (integrityCheckPromise) return integrityCheckPromise;
  integrityCheckPromise = (async () => {
    try {
      const count = await prisma.serviceType.count();
      // The product has exactly 5 service types (regular, same-day, deep, eot,
      // airbnb). "one-off" is a booking-frequency multiplier, not a service
      // type — so the gate is 5, matching the deploy seed's row count.
      if (count < 5) {
        throw new ReferenceDataMissingError(
          `Reference data missing: ServiceType has ${count} rows, expected at least 5. Run 'npm run db:seed-reference'.`
        );
      }
    } catch (err) {
      if (err instanceof ReferenceDataMissingError) throw err;
      log.warn('integrity_check', 'could_not_verify_reference_data', {}, err);
    }
  })();
  return integrityCheckPromise;
}
