/* eslint-disable no-console */
// STAGING ONLY (James's infrastructure word, 23 Oct): the synthetic seed for
// the rena-staging Railway project, used by the Pro-1 and Customer-1 preview
// walks. Never run against production: it refuses unless every guard below
// holds. Synthetic people only (@integration.invalid); the password comes
// from STAGING_SEED_PASSWORD, never from the repo.
//
// Runs as the rena-staging web service's pre-deploy command, so it runs
// before every staging deploy; SEED_MODE unset or none does nothing, so an
// ordinary main merge never reseeds. Modes (SEED_MODE):
//   none      nothing (the default)
//   base      the accounts, the customer's bookings, messages and the
//             cleaner's public page (idempotent; rerun safely)
//   offer     a new live offer to the cleaner, with the real offer push
//             (the device must have signed in to staging first)
//   offer-expiring   the same, with a window that closes in 90 seconds
import bcrypt from 'bcryptjs';

import { PrismaClient } from '@prisma/client';

import { seedMode, seedRefusals } from './guard';

const DOMAIN = '@integration.invalid';
export const STAGING = {
  cleaner: { email: `staging-cleaner${DOMAIN}`, name: 'Stella Staging' },
  customer: { email: `staging-customer${DOMAIN}`, name: 'Casey Staging' },
  admin: { email: `staging-admin${DOMAIN}`, name: 'Ada Staging' },
} as const;

const prisma = new PrismaClient();

async function user(key: keyof typeof STAGING, role: 'CLEANER' | 'CLIENT' | 'ADMIN', hash: string) {
  const f = STAGING[key];
  const now = new Date();
  return prisma.user.upsert({
    where: { email: f.email },
    update: { passwordHash: hash, role, accountStatus: 'ACTIVE', isDeleted: false },
    create: {
      email: f.email,
      name: f.name,
      role,
      passwordHash: hash,
      emailVerified: now,
      emailVerifiedAt: now,
    },
  });
}

/** A day N days from today at UTC midnight (the booking date column). */
const dayFromNow = (n: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};

const MONEY = { totalPrice: 72, platformFee: 4.08, cleanerEarnings: 60, duration: 3 };

async function base(hash: string) {
  const cleaner = await user('cleaner', 'CLEANER', hash);
  const customer = await user('customer', 'CLIENT', hash);
  await user('admin', 'ADMIN', hash);

  // Eligible on every public rule, so /cleaners/<id> renders and offers can
  // be made. The Stripe account id is fake and never called.
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
    latitude: 51.6316,
    longitude: -0.0003,
    maxTravelMinutes: 30,
    bio: 'Synthetic staging cleaner for app walks. Not a real person.',
  };
  const profile = await prisma.cleanerProfile.upsert({
    where: { userId: cleaner.id },
    update: bookable,
    create: { userId: cleaner.id, specialties: [], languages: ['English'], ...bookable },
  });
  await prisma.availabilitySlot.deleteMany({ where: { cleanerProfileId: profile.id } });
  await prisma.availabilitySlot.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      cleanerProfileId: profile.id,
      dayOfWeek,
      startTime: '09:00',
      endTime: '17:00',
    })),
  });

  const address =
    (await prisma.address.findFirst({ where: { userId: customer.id } })) ??
    (await prisma.address.create({
      data: {
        userId: customer.id,
        label: 'Home',
        line1: '1 Staging Road',
        city: 'Chingford',
        postcode: 'E4 9AA',
        isDefault: true,
      },
    }));

  // One confirmed booking (the link target for booking and messages) and one
  // completed. Recreated on each base run so the ids stay few and current.
  await prisma.booking.deleteMany({
    where: { clientId: customer.id, notes: { startsWith: '[staging-seed]' } },
  });
  const common = {
    clientId: customer.id,
    cleanerId: cleaner.id,
    addressId: address.id,
    addressLine1: address.line1,
    addressCity: address.city,
    addressPostcode: address.postcode,
    serviceType: 'regular',
    startTime: '10:00',
    extras: [],
    frequency: 'one-off',
    ...MONEY,
  };
  const confirmed = await prisma.booking.create({
    data: {
      ...common,
      status: 'CONFIRMED',
      date: dayFromNow(3),
      acceptedAt: new Date(),
      notes: '[staging-seed] confirmed',
    },
  });
  const completed = await prisma.booking.create({
    data: {
      ...common,
      status: 'COMPLETED',
      date: dayFromNow(-7),
      completedAt: dayFromNow(-7),
      notes: '[staging-seed] completed',
    },
  });
  await prisma.message.createMany({
    data: [
      {
        senderId: customer.id,
        receiverId: cleaner.id,
        bookingId: confirmed.id,
        content: 'Hi, the key is with the concierge. (staging message)',
      },
      {
        senderId: cleaner.id,
        receiverId: customer.id,
        bookingId: confirmed.id,
        content: 'Thanks, see you at 10. (staging message)',
      },
    ],
  });
  console.log(
    `[staging-seed] base ok: cleanerUserId=${cleaner.id} cleanerProfileId=${profile.id} customerUserId=${customer.id} confirmedBooking=${confirmed.id} completedBooking=${completed.id}`
  );
}

async function offer(windowMs: number) {
  const cleaner = await prisma.user.findUniqueOrThrow({ where: { email: STAGING.cleaner.email } });
  const customer = await prisma.user.findUniqueOrThrow({
    where: { email: STAGING.customer.email },
  });
  const devices = await prisma.deviceToken.count({ where: { userId: cleaner.id } });
  const booking = await prisma.booking.create({
    data: {
      clientId: customer.id,
      cleanerId: cleaner.id,
      addressLine1: '1 Staging Road',
      addressCity: 'Chingford',
      addressPostcode: 'E4 9AA',
      serviceType: 'regular',
      startTime: '11:00',
      extras: [],
      frequency: 'one-off',
      status: 'AWAITING_CLEANER',
      date: dayFromNow(5),
      cascadePhase: 'PRIMARY_OFFER',
      cascadeExpiresAt: new Date(Date.now() + windowMs),
      notes: '[staging-seed] offer',
      ...MONEY,
    },
  });
  const { EnhancedNotificationService } =
    await import('../../src/lib/services/enhanced-notification.service');
  await EnhancedNotificationService.sendNewOfferPush(booking.id, cleaner.id);
  const queued = await prisma.backgroundJob.count({
    where: { type: 'EXPO_PUSH', createdAt: { gte: new Date(Date.now() - 60_000) } },
  });
  console.log(
    `[staging-seed] offer ok: booking=${booking.id} window=${Math.round(windowMs / 1000)}s cleanerDevices=${devices} pushQueued=${queued > 0}`
  );
}

async function main() {
  const mode = seedMode(process.env.SEED_MODE);
  if (mode === null) throw new Error('unknown SEED_MODE');
  if (mode === 'none') {
    console.log('[staging-seed] SEED_MODE none: nothing to do');
    return;
  }
  const refusals = seedRefusals(process.env);
  if (refusals.length) {
    console.error(`[staging-seed] REFUSED: ${refusals.join('; ')}`);
    process.exitCode = 1;
    return;
  }
  const password = process.env.STAGING_SEED_PASSWORD as string;
  if (mode === 'base') await base(await bcrypt.hash(password, 10));
  else if (mode === 'offer') await offer(30 * 60_000);
  else await offer(90_000);
}

main()
  .catch((e) => {
    console.error('[staging-seed] failed:', (e as Error).message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
