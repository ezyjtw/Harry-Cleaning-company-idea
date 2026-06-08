/**
 * Sets up a Stripe test-mode Express Connect account for a dev cleaner.
 *
 * Usage:
 *   npx tsx scripts/setup-test-connect-account.ts <cleaner-email>
 *
 * Prerequisites:
 *   - STRIPE_SECRET_KEY in .env.local must be a test-mode key (sk_test_...)
 *   - DATABASE_URL must point to your local/dev database
 *   - The cleaner must already exist in the database (run prisma/seed.ts first)
 *   - The cleaner must have a CleanerProfile
 *
 * What it does:
 *   1. Looks up the cleaner by email
 *   2. Creates a Stripe Express account in test mode (or reuses existing)
 *   3. Sets stripeAccountId, stripeChargesEnabled, stripePayoutsEnabled on the profile
 *   4. Prints an onboarding link for completing test-mode verification (optional)
 *
 * In test mode, charges/payouts are enabled immediately for Express accounts
 * created via the API, so the account is usable for testing right away.
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.error('STRIPE_SECRET_KEY not set. Add it to .env.local');
  process.exit(1);
}
if (!stripeKey.startsWith('sk_test_')) {
  console.error('STRIPE_SECRET_KEY is not a test key. This script must only run in test mode.');
  process.exit(1);
}

const stripe = new Stripe(stripeKey);

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/setup-test-connect-account.ts <cleaner-email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { cleanerProfile: true },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  if (!user.cleanerProfile) {
    console.error(`User ${email} has no CleanerProfile`);
    process.exit(1);
  }

  const profile = user.cleanerProfile;

  // Reuse existing account if already set up
  if (profile.stripeAccountId) {
    console.log(`Cleaner already has Stripe account: ${profile.stripeAccountId}`);
    const account = await stripe.accounts.retrieve(profile.stripeAccountId);
    console.log(`  charges_enabled: ${account.charges_enabled}`);
    console.log(`  payouts_enabled: ${account.payouts_enabled}`);

    if (!profile.stripeChargesEnabled || !profile.stripePayoutsEnabled) {
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          stripeChargesEnabled: account.charges_enabled ?? false,
          stripePayoutsEnabled: account.payouts_enabled ?? false,
          stripeOnboardedAt: new Date(),
        },
      });
      console.log('  Updated DB flags to match Stripe.');
    }
    return;
  }

  // Create a new Express account
  console.log(`Creating Stripe Express account for ${email}...`);
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'GB',
    email: user.email ?? undefined,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  console.log(`  Account created: ${account.id}`);

  // In test mode, enable charges/payouts directly
  await prisma.cleanerProfile.update({
    where: { id: profile.id },
    data: {
      stripeAccountId: account.id,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      stripeOnboardedAt: new Date(),
    },
  });

  console.log('  DB updated: stripeAccountId, charges/payouts enabled.');

  // Generate an onboarding link (optional — in test mode the account works without it)
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: 'http://localhost:3000/cleaner/stripe/connect',
    return_url: 'http://localhost:3000/cleaner/stripe/connect?success=true',
    type: 'account_onboarding',
  });

  console.log(`\n  Onboarding link (optional, for full verification):`);
  console.log(`  ${link.url}\n`);
  console.log('Done. The cleaner can now receive test transfers.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
