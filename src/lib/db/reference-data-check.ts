import prisma from '@/lib/db/prisma';

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
      if (count < 6) {
        throw new ReferenceDataMissingError(
          `Reference data missing: ServiceType has ${count} rows, expected at least 6. Run 'npm run db:seed-reference'.`
        );
      }
    } catch (err) {
      if (err instanceof ReferenceDataMissingError) throw err;
      // eslint-disable-next-line no-console
      console.warn('[Integrity check] Could not verify reference data:', err);
    }
  })();
  return integrityCheckPromise;
}
