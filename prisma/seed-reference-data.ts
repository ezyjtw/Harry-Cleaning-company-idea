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

// Fixed-price rows for the two FIXED services: the calendar hold per property
// size (LB-6). Every FIXED service needs a row for all 6 PropertySize values.
// B6 (D-ad): the dead customer price column is gone; the price is the cleaner's own.
const FIXED_PRICES: Record<
  string,
  Array<{ propertySize: PropertySize; estimatedHours: number }>
> = {
  eot: [
    { propertySize: 'STUDIO', estimatedHours: 4 },
    { propertySize: 'ONE_BED', estimatedHours: 5 },
    { propertySize: 'TWO_BED', estimatedHours: 6 },
    // LB-6 gate (James-adjusted): these are the REAL calendar holds now, so the
    // larger sizes came down to fit real working days (3-bed 8→7, 4-bed 10→9,
    // 5+ 13→11). "Team cleans" is the ledgered honest answer to jobs that
    // still exceed a single cleaner's day.
    { propertySize: 'THREE_BED', estimatedHours: 7 },
    { propertySize: 'FOUR_BED', estimatedHours: 9 },
    { propertySize: 'FIVE_PLUS', estimatedHours: 11 },
  ],
  airbnb: [
    // F24.4b (James-ruled): 2h is the honest middle for a full changeover —
    // 1.5h was the aggressive end, and under-blocking is the failure mode
    // already paid for once (LB-6).
    { propertySize: 'STUDIO', estimatedHours: 2 },
    { propertySize: 'ONE_BED', estimatedHours: 2 },
    { propertySize: 'TWO_BED', estimatedHours: 2.5 },
    { propertySize: 'THREE_BED', estimatedHours: 3.5 },
    { propertySize: 'FOUR_BED', estimatedHours: 4.5 },
    { propertySize: 'FIVE_PLUS', estimatedHours: 5 },
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

// B4 (RENA-075): cleaner_fee_pct and customer_fee_pct are gone; the rates are
// code (src/lib/pricing/rates.ts) and the money_ledger migration deleted the
// rows. N8 (James-ruled): every row below is create-if-missing, so an admin's
// edit is never reset by a deploy. B6 (D-ad): the four multiplier keys were
// inert (cleaner-set rates, no multipliers) and are gone; the
// pricing_dead_furniture migration deleted their rows.
const PLATFORM_CONFIG = [
  {
    key: 'min_cleaner_rate',
    value: '14.00',
    description: 'Minimum advertised cleaner hourly rate',
  },
  {
    key: 'max_cleaner_rate',
    value: '35.00',
    description: 'Maximum advertised cleaner hourly rate',
  },
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
        update: { estimatedHours: fp.estimatedHours },
        create: {
          serviceTypeId: serviceType.id,
          propertySize: fp.propertySize,
          estimatedHours: fp.estimatedHours,
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
        await prisma.serviceAddon.update({
          where: { id: existing.id },
          data: { price: addon.price },
        });
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
      update: {},
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

  // 5b) R9 HQ markers — create-only, same CAS-guard pattern as the compliance
  // marker. hq_api_amber_pct is a VALUE James can edit (amber threshold for the
  // HQ API room, percent of a provider's documented limit), so update:{} keeps
  // a manual change; the places marker is a week-guard for the refresh lane.
  await prisma.platformConfig.upsert({
    where: { key: 'hq_api_amber_pct' },
    update: {},
    create: {
      key: 'hq_api_amber_pct',
      value: '80',
      description: 'R9 HQ API room: amber warning threshold as % of documented provider limit.',
    },
  });
  await prisma.platformConfig.upsert({
    where: { key: 'last_places_refresh_week' },
    update: {},
    create: {
      key: 'last_places_refresh_week',
      value: '1970-W01',
      description:
        'R9 HQ: last ISO week the Places competitor-intel refresh ran (week-guard marker).',
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
