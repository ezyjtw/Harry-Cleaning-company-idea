import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const serviceTypes = [
  {
    slug: 'regular',
    name: 'Regular Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.0,
    minimumHours: 2.0,
  },
  {
    slug: 'one-off',
    name: 'One-Off Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.15,
    minimumHours: 2.0,
  },
  {
    slug: 'same-day',
    name: 'Same-Day Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.3,
    minimumHours: 2.0,
  },
  {
    slug: 'deep',
    name: 'Deep Cleaning',
    pricingModel: 'HOURLY' as const,
    baseMultiplier: 1.45,
    minimumHours: 3.0,
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
    name: 'Airbnb Cleaning',
    pricingModel: 'FIXED' as const,
    baseMultiplier: 1.0,
    minimumHours: null,
  },
];

const fixedPrices = {
  eot: [
    { propertySize: 'STUDIO' as const, estimatedHours: 4, customerPrice: 175 },
    { propertySize: 'ONE_BED' as const, estimatedHours: 5, customerPrice: 220 },
    { propertySize: 'TWO_BED' as const, estimatedHours: 6, customerPrice: 280 },
    { propertySize: 'THREE_BED' as const, estimatedHours: 8, customerPrice: 350 },
    { propertySize: 'FOUR_BED' as const, estimatedHours: 10, customerPrice: 430 },
    { propertySize: 'FIVE_PLUS' as const, estimatedHours: 13, customerPrice: 550 },
  ],
  airbnb: [
    { propertySize: 'STUDIO' as const, estimatedHours: 1.5, customerPrice: 55 },
    { propertySize: 'ONE_BED' as const, estimatedHours: 2, customerPrice: 75 },
    { propertySize: 'TWO_BED' as const, estimatedHours: 2.5, customerPrice: 95 },
    { propertySize: 'THREE_BED' as const, estimatedHours: 3.5, customerPrice: 120 },
    { propertySize: 'FOUR_BED' as const, estimatedHours: 4.5, customerPrice: 155 },
    { propertySize: 'FIVE_PLUS' as const, estimatedHours: 5, customerPrice: 155 },
  ],
};

const eotAddons = [
  { name: 'Oven deep clean', price: 40 },
  { name: 'Carpet deep clean (per room)', price: 45 },
  { name: 'Interior window clean', price: 25 },
  { name: 'Fridge clean', price: 20 },
];

const airbnbAddons = [
  { name: 'Same-day turnaround (under 3hr notice)', price: 25 },
  { name: 'Post-party deep clean', price: 40 },
];

const platformConfig = [
  {
    key: 'cleaner_fee_pct',
    value: '0.10',
    description: 'Platform fee deducted from cleaner payout (10%)',
  },
  {
    key: 'customer_fee_pct',
    value: '0.05',
    description: 'Service fee added on top for customer (5%)',
  },
  {
    key: 'same_day_multiplier',
    value: '1.30',
    description: 'Urgency multiplier for same-day bookings',
  },
  {
    key: 'one_off_multiplier',
    value: '1.15',
    description: 'One-off booking premium',
  },
  {
    key: 'fortnightly_multiplier',
    value: '1.05',
    description: 'Fortnightly vs weekly premium',
  },
  {
    key: 'deep_multiplier',
    value: '1.45',
    description:
      'Deep clean labour intensity premium — also applied to derive cleaner deep rate for EOT/Airbnb',
  },
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

async function seedPricing() {
  // eslint-disable-next-line no-console
  console.log('Seeding pricing data...');

  // Upsert service types
  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { slug: st.slug },
      update: {
        name: st.name,
        pricingModel: st.pricingModel,
        baseMultiplier: st.baseMultiplier,
        minimumHours: st.minimumHours,
      },
      create: st,
    });
  }

  // Seed fixed prices
  for (const [slug, prices] of Object.entries(fixedPrices)) {
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
        update: {
          estimatedHours: fp.estimatedHours,
          customerPrice: fp.customerPrice,
        },
        create: {
          serviceTypeId: serviceType.id,
          propertySize: fp.propertySize,
          estimatedHours: fp.estimatedHours,
          customerPrice: fp.customerPrice,
        },
      });
    }
  }

  // Seed addons
  const eotService = await prisma.serviceType.findUnique({ where: { slug: 'eot' } });
  const airbnbService = await prisma.serviceType.findUnique({ where: { slug: 'airbnb' } });

  if (eotService) {
    for (const addon of eotAddons) {
      const existing = await prisma.serviceAddon.findFirst({
        where: { serviceTypeId: eotService.id, name: addon.name },
      });
      if (!existing) {
        await prisma.serviceAddon.create({
          data: { serviceTypeId: eotService.id, ...addon },
        });
      }
    }
  }

  if (airbnbService) {
    for (const addon of airbnbAddons) {
      const existing = await prisma.serviceAddon.findFirst({
        where: { serviceTypeId: airbnbService.id, name: addon.name },
      });
      if (!existing) {
        await prisma.serviceAddon.create({
          data: { serviceTypeId: airbnbService.id, ...addon },
        });
      }
    }
  }

  // Seed platform config
  for (const config of platformConfig) {
    await prisma.platformConfig.upsert({
      where: { key: config.key },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  // eslint-disable-next-line no-console
  console.log('Pricing seed complete.');
}

seedPricing()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
