/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICE_TYPES = [
  {
    slug: 'regular',
    name: 'Regular Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.0,
    minimumHours: 2,
  },
  {
    slug: 'one-off',
    name: 'One-Off Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.1,
    minimumHours: 2,
  },
  {
    slug: 'same-day',
    name: 'Same Day Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.3,
    minimumHours: 2,
  },
  {
    slug: 'deep',
    name: 'Deep Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.45,
    minimumHours: 3,
  },
  {
    slug: 'eot',
    name: 'End of Tenancy',
    pricingModel: 'FIXED' as const,
    baseMultiplier: 1.45,
    minimumHours: null,
  },
  {
    slug: 'airbnb',
    name: 'Airbnb Turnaround',
    pricingModel: 'FIXED' as const,
    baseMultiplier: 1.45,
    minimumHours: null,
  },
];

async function main() {
  console.log('[seed-reference-data] Syncing reference data...');

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

  const count = await prisma.serviceType.count();
  console.log(`[seed-reference-data] ServiceType: ${count} rows (expected >= 6)`);
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
