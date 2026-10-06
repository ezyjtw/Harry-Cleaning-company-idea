import bcrypt from 'bcryptjs';

// B2a: synthetic fixture accounts for the signed-in specs (no real people,
// integration.invalid addresses, a fixture-only password). Upserted, so the
// setup is idempotent on the rig and on CI's throwaway Postgres. Skipped when
// no database is reachable from the test runner; the specs that need these
// accounts then skip themselves (see e2e/fixtures.ts).
export const FIXTURE_PASSWORD = 'E2e-Fixture-Pass-2026!';

export const FIXTURES = {
  customerA: { email: 'e2e-customer-a@integration.invalid', name: 'Alpha Fixture' },
  customerB: { email: 'e2e-customer-b@integration.invalid', name: 'Bravo Fixture' },
  cleaner: { email: 'e2e-cleaner@integration.invalid', name: 'Cleo Fixture' },
} as const;

export default async function globalSetup(): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 10);
    const now = new Date();
    for (const key of ['customerA', 'customerB'] as const) {
      const f = FIXTURES[key];
      await prisma.user.upsert({
        where: { email: f.email },
        update: { passwordHash, accountStatus: 'ACTIVE', role: 'CLIENT' },
        create: {
          email: f.email,
          name: f.name,
          role: 'CLIENT',
          passwordHash,
          emailVerified: now,
          emailVerifiedAt: now,
        },
      });
    }
    const cleaner = await prisma.user.upsert({
      where: { email: FIXTURES.cleaner.email },
      update: { passwordHash, accountStatus: 'ACTIVE', role: 'CLEANER' },
      create: {
        email: FIXTURES.cleaner.email,
        name: FIXTURES.cleaner.name,
        role: 'CLEANER',
        passwordHash,
        emailVerified: now,
        emailVerifiedAt: now,
      },
    });
    const bookable = {
      serviceTypes: ['regular', 'deep'],
      hourlyRateRegular: 20,
      hourlyRateDeep: 24,
      verified: true,
      insuranceVerified: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      visibleInDirectory: true,
      postcode: 'E4 9AA',
      location: 'Chingford',
    };
    await prisma.cleanerProfile.upsert({
      where: { userId: cleaner.id },
      update: bookable,
      create: { userId: cleaner.id, specialties: [], languages: ['English'], ...bookable },
    });
  } catch (e) {
    // A database that cannot be prepared is not a reason to fail the public
    // suite; the signed-in specs check for their accounts and skip.
    // eslint-disable-next-line no-console
    console.warn('[e2e global-setup] fixtures not prepared:', (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}
