/* eslint-disable no-console */
import { PrismaClient, type PropertySize } from '@prisma/client';

const prisma = new PrismaClient();

// ── Reference data the app depends on to function. Idempotent upserts, run on
//    every Railway deploy via the start command. This file is the SINGLE source
//    of truth — every deploy syncs the DB to match. Manual DB edits are
//    overwritten on the next deploy. ───────────────────────────────────────────

const SERVICE_TYPES = [
  {
    slug: 'regular',
    name: 'Regular Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.0,
    minimumHours: 2,
  },
  {
    slug: 'same-day',
    name: 'Same Day Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.0,
    minimumHours: 2,
  },
  {
    slug: 'deep',
    name: 'Deep Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.0,
    minimumHours: 3,
  },
  {
    slug: 'eot',
    name: 'End of Tenancy',
    pricingModel: 'FIXED' as const,
    baseMultiplier: 1.0,
    minimumHours: null,
  },
  {
    slug: 'airbnb',
    name: 'Airbnb Turnaround',
    pricingModel: 'FIXED' as const,
    baseMultiplier: 1.0,
    minimumHours: null,
  },
];

// Fixed-price rows for the two FIXED services. Every FIXED service needs a row
// for all 6 PropertySize values or the booking flow returns empty pricing.
const FIXED_PRICES: Record<
  string,
  Array<{ propertySize: PropertySize; estimatedHours: number; customerPrice: number }>
> = {
  eot: [
    { propertySize: 'STUDIO', estimatedHours: 4, customerPrice: 175 },
    { propertySize: 'ONE_BED', estimatedHours: 5, customerPrice: 220 },
    { propertySize: 'TWO_BED', estimatedHours: 6, customerPrice: 280 },
    { propertySize: 'THREE_BED', estimatedHours: 8, customerPrice: 350 },
    { propertySize: 'FOUR_BED', estimatedHours: 10, customerPrice: 430 },
    { propertySize: 'FIVE_PLUS', estimatedHours: 13, customerPrice: 550 },
  ],
  airbnb: [
    { propertySize: 'STUDIO', estimatedHours: 1.5, customerPrice: 55 },
    { propertySize: 'ONE_BED', estimatedHours: 2, customerPrice: 75 },
    { propertySize: 'TWO_BED', estimatedHours: 2.5, customerPrice: 95 },
    { propertySize: 'THREE_BED', estimatedHours: 3.5, customerPrice: 120 },
    { propertySize: 'FOUR_BED', estimatedHours: 4.5, customerPrice: 155 },
    { propertySize: 'FIVE_PLUS', estimatedHours: 5, customerPrice: 155 },
  ],
};

const ADDONS: Record<string, Array<{ name: string; price: number }>> = {
  eot: [
    { name: 'Oven deep clean', price: 40 },
    { name: 'Carpet deep clean (per room)', price: 45 },
    { name: 'Interior window clean', price: 25 },
    { name: 'Fridge clean', price: 20 },
  ],
  airbnb: [
    { name: 'Same-day turnaround (under 3hr notice)', price: 25 },
    { name: 'Post-party deep clean', price: 40 },
  ],
};

const PLATFORM_CONFIG = [
  { key: 'cleaner_fee_pct', value: '0.10', description: 'Platform fee deducted from cleaner payout (10%)' },
  { key: 'customer_fee_pct', value: '0.06', description: 'Service fee added on top for customer (6%)' },
  { key: 'same_day_multiplier', value: '1.30', description: 'Urgency multiplier for same-day bookings' },
  { key: 'one_off_multiplier', value: '1.10', description: 'One-off booking surge' },
  { key: 'fortnightly_multiplier', value: '1.05', description: 'Fortnightly vs weekly premium' },
  {
    key: 'deep_multiplier',
    value: '1.45',
    description:
      'Deep clean labour intensity premium — also applied to derive cleaner deep rate for EOT/Airbnb',
  },
  { key: 'min_cleaner_rate', value: '14.00', description: 'Minimum advertised cleaner hourly rate' },
  { key: 'max_cleaner_rate', value: '35.00', description: 'Maximum advertised cleaner hourly rate' },
];

// Operational marker for the daily compliance-job day-guard (see
// scheduler.service.ts). Seeded create-only so re-deploys never reset it —
// otherwise every deploy would re-trigger the retention batch.
const COMPLIANCE_MARKER_KEY = 'last_compliance_run_date';

async function main() {
  console.log('[seed-reference-data] Syncing reference data...');

  // 1) Service types
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({
      where: { slug: st.slug },
      update: {
        name: st.name,
        pricingModel: st.pricingModel,
        baseMultiplier: st.baseMultiplier,
        minimumHours: st.minimumHours,
      },
      create: {
        slug: st.slug,
        name: st.name,
        pricingModel: st.pricingModel,
        baseMultiplier: st.baseMultiplier,
        minimumHours: st.minimumHours,
      },
    });
  }

  // 2) Fixed prices (keyed on the unique (serviceTypeId, propertySize))
  let fixedPriceCount = 0;
  for (const [slug, prices] of Object.entries(FIXED_PRICES)) {
    const serviceType = await prisma.serviceType.findUnique({ where: { slug } });
    if (!serviceType) continue;
    for (const fp of prices) {
      await prisma.fixedServicePrice.upsert({
        where: {
          serviceTypeId_propertySize: {
            serviceTypeId: serviceType.id,
            propertySize: fp.propertySize,
          },
        },
        update: { estimatedHours: fp.estimatedHours, customerPrice: fp.customerPrice },
        create: {
          serviceTypeId: serviceType.id,
          propertySize: fp.propertySize,
          estimatedHours: fp.estimatedHours,
          customerPrice: fp.customerPrice,
        },
      });
      fixedPriceCount++;
    }
  }

  // 3) Add-ons (no unique constraint on (serviceTypeId, name) → guard on findFirst)
  for (const [slug, addons] of Object.entries(ADDONS)) {
    const serviceType = await prisma.serviceType.findUnique({ where: { slug } });
    if (!serviceType) continue;
    for (const addon of addons) {
      const existing = await prisma.serviceAddon.findFirst({
        where: { serviceTypeId: serviceType.id, name: addon.name },
      });
      if (existing) {
        await prisma.serviceAddon.update({ where: { id: existing.id }, data: { price: addon.price } });
      } else {
        await prisma.serviceAddon.create({
          data: { serviceTypeId: serviceType.id, name: addon.name, price: addon.price },
        });
      }
    }
  }

  // 4) Platform config
  for (const config of PLATFORM_CONFIG) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  // 5) Compliance day-guard marker — create-only (never reset on redeploy)
  await prisma.platformConfig.upsert({
    where: { key: COMPLIANCE_MARKER_KEY },
    update: {},
    create: {
      key: COMPLIANCE_MARKER_KEY,
      value: '1970-01-01',
      description: 'Last UTC date the daily compliance/retention batch ran (day-guard marker).',
    },
  });

  const serviceTypeCount = await prisma.serviceType.count();
  console.log(
    `[seed-reference-data] ServiceType: ${serviceTypeCount} rows (expected >= 5); FixedServicePrice synced: ${fixedPriceCount}; PlatformConfig + addons synced.`
  );
  console.log('[seed-reference-data] Done.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('[seed-reference-data] Failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
