/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('Seeding database...');

  // ─── Admin User ────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rena.com' },
    update: {},
    create: {
      email: 'admin@rena.com',
      name: 'Rena Admin',
      phone: '+44 7700 000000',
      role: 'ADMIN',
      passwordHash: await bcrypt.hash('admin123', SALT_ROUNDS),
      emailVerified: new Date(),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  Admin: ${admin.email}`);

  // ─── Client User ───────────────────────────────────────────
  const client = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: {},
    create: {
      email: 'sarah@example.com',
      name: 'Sarah Johnson',
      phone: '+44 7700 900001',
      role: 'CLIENT',
      passwordHash: await bcrypt.hash('password123', SALT_ROUNDS),
      emailVerified: new Date(),
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`  Client: ${client.email}`);

  // ─── Client Address ────────────────────────────────────────
  await prisma.address.upsert({
    where: { id: 'seed-address-1' },
    update: {},
    create: {
      id: 'seed-address-1',
      userId: client.id,
      label: 'Home',
      line1: '42 Lavender Gardens',
      city: 'London',
      postcode: 'SW11 1DJ',
      isDefault: true,
    },
  });

  // ─── Cleaner Users with Profiles ───────────────────────────
  const cleanerData = [
    {
      email: 'maria@example.com',
      name: 'Maria Santos',
      phone: '+44 7700 900010',
      bio: 'Professional cleaner with 8 years of experience. I take pride in leaving every home spotless and fresh. Specializing in eco-friendly products that are safe for families and pets.',
      hourlyRate: 18,
      specialties: ['Deep Cleaning', 'Regular Cleaning', 'Pet-Friendly'],
      location: 'Clapham, London',
      postcode: 'SW4',
      completedJobs: 520,
      rating: 4.9,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: true,
    },
    {
      email: 'james@example.com',
      name: 'James Wilson',
      phone: '+44 7700 900011',
      bio: 'Detail-oriented cleaner who treats every home like my own. Certified in commercial and residential cleaning with a focus on kitchens and bathrooms.',
      hourlyRate: 16,
      specialties: ['Regular Cleaning', 'Deep Cleaning'],
      location: 'Brixton, London',
      postcode: 'SW9',
      completedJobs: 312,
      rating: 4.8,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: false,
    },
    {
      email: 'aisha@example.com',
      name: 'Aisha Johnson',
      phone: '+44 7700 900012',
      bio: 'Experienced in end-of-tenancy and Airbnb turnovers. Fast, thorough, and always on time. I bring my own eco-friendly products.',
      hourlyRate: 20,
      specialties: ['End of Tenancy', 'Airbnb Cleaning', 'Deep Cleaning'],
      location: 'Battersea, London',
      postcode: 'SW11',
      completedJobs: 189,
      rating: 4.7,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: true,
    },
    {
      email: 'katarzyna@example.com',
      name: 'Katarzyna Nowak',
      phone: '+44 7700 900013',
      bio: 'Reliable and efficient cleaner from Poland with 5 years UK experience. Fluent in Polish and English. Specialising in regular domestic cleaning.',
      hourlyRate: 15,
      specialties: ['Regular Cleaning', 'Pet-Friendly'],
      location: 'Tooting, London',
      postcode: 'SW17',
      completedJobs: 245,
      rating: 4.85,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: false,
    },
    {
      email: 'elena@example.com',
      name: 'Elena Petrova',
      phone: '+44 7700 900014',
      bio: 'Professional cleaner from Bulgaria. Attention to detail is my priority. I speak Bulgarian, Russian, and English.',
      hourlyRate: 17,
      specialties: ['Deep Cleaning', 'Regular Cleaning', 'End of Tenancy'],
      location: 'Wandsworth, London',
      postcode: 'SW18',
      completedJobs: 178,
      rating: 4.75,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: true,
    },
    {
      email: 'agnieszka@example.com',
      name: 'Agnieszka Kowalska',
      phone: '+44 7700 900015',
      bio: 'Hard-working cleaner from Poland. 7 years experience in London homes. I take pride in a spotless finish every time.',
      hourlyRate: 16,
      specialties: ['Regular Cleaning', 'Deep Cleaning', 'Airbnb Cleaning'],
      location: 'Balham, London',
      postcode: 'SW12',
      completedJobs: 402,
      rating: 4.92,
      verified: true,
      backgroundCheckPassed: true,
      availableNow: false,
    },
  ];

  for (const data of cleanerData) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {},
      create: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        role: 'CLEANER',
        passwordHash: await bcrypt.hash('password123', SALT_ROUNDS),
        emailVerified: new Date(),
        emailVerifiedAt: new Date(),
      },
    });

    await prisma.cleanerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        bio: data.bio,
        hourlyRate: data.hourlyRate,
        specialties: data.specialties,
        location: data.location,
        postcode: data.postcode,
        completedJobs: data.completedJobs,
        rating: data.rating,
        verified: data.verified,
        backgroundCheckPassed: data.backgroundCheckPassed,
        dbsCertVerified: true,
        verificationStatus: 'VERIFIED',
        availableNow: data.availableNow,
        responseTime: Math.floor(Math.random() * 10) + 5,
        radius: 10,
      },
    });

    // Add availability slots (weekdays)
    const days = [1, 2, 3, 4, 5]; // Mon-Fri
    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId: user.id },
    });
    if (profile) {
      for (const day of days) {
        await prisma.availabilitySlot.upsert({
          where: {
            id: `seed-avail-${user.id}-${day}`,
          },
          update: {},
          create: {
            id: `seed-avail-${user.id}-${day}`,
            cleanerProfileId: profile.id,
            dayOfWeek: day,
            startTime: '08:00',
            endTime: '18:00',
          },
        });
      }
    }

    console.log(`  Cleaner: ${data.name} (${data.email})`);
  }

  // ─── Service Types ─────────────────────────────────────────
  const serviceTypes = [
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

  for (const st of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { slug: st.slug },
      update: {},
      create: {
        slug: st.slug,
        name: st.name,
        pricingModel: st.pricingModel,
        baseMultiplier: st.baseMultiplier,
        minimumHours: st.minimumHours,
      },
    });
  }
  console.log('  Service types seeded');

  // ─── Platform Config ──────────────────────────────────────
  const platformConfigs = [
    {
      key: 'cleaner_fee_pct',
      value: '0.10',
      description: 'Platform commission taken from cleaner (10%)',
    },
    { key: 'customer_fee_pct', value: '0.06', description: 'Service fee charged to customer (6%)' },
    {
      key: 'deep_multiplier',
      value: '1.45',
      description: 'Rate multiplier for deep clean / fixed-price services',
    },
    {
      key: 'fortnightly_multiplier',
      value: '1.05',
      description: 'Rate multiplier for fortnightly bookings',
    },
    { key: 'min_cleaner_rate', value: '14', description: 'Minimum cleaner hourly rate (£)' },
    { key: 'max_cleaner_rate', value: '35', description: 'Maximum cleaner hourly rate (£)' },
  ];

  for (const cfg of platformConfigs) {
    await prisma.platformConfig.upsert({
      where: { key: cfg.key },
      update: { value: cfg.value, description: cfg.description },
      create: cfg,
    });
  }
  console.log('  Platform config seeded');

  // ─── Fixed Service Prices (EOT & Airbnb) ──────────────────
  const eotService = await prisma.serviceType.findUnique({ where: { slug: 'eot' } });
  const airbnbService = await prisma.serviceType.findUnique({ where: { slug: 'airbnb' } });

  if (eotService) {
    const eotPrices: {
      propertySize: 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED' | 'FOUR_BED' | 'FIVE_PLUS';
      customerPrice: number;
      estimatedHours: number;
    }[] = [
      { propertySize: 'STUDIO', customerPrice: 175, estimatedHours: 4 },
      { propertySize: 'ONE_BED', customerPrice: 215, estimatedHours: 5 },
      { propertySize: 'TWO_BED', customerPrice: 275, estimatedHours: 6 },
      { propertySize: 'THREE_BED', customerPrice: 350, estimatedHours: 7 },
      { propertySize: 'FOUR_BED', customerPrice: 420, estimatedHours: 8 },
      { propertySize: 'FIVE_PLUS', customerPrice: 520, estimatedHours: 10 },
    ];
    for (const fp of eotPrices) {
      await prisma.fixedServicePrice.upsert({
        where: {
          serviceTypeId_propertySize: {
            serviceTypeId: eotService.id,
            propertySize: fp.propertySize,
          },
        },
        update: { customerPrice: fp.customerPrice, estimatedHours: fp.estimatedHours },
        create: { serviceTypeId: eotService.id, ...fp },
      });
    }
    console.log('  EOT fixed prices seeded');
  }

  if (airbnbService) {
    const airbnbPrices: {
      propertySize: 'STUDIO' | 'ONE_BED' | 'TWO_BED' | 'THREE_BED' | 'FOUR_BED' | 'FIVE_PLUS';
      customerPrice: number;
      estimatedHours: number;
    }[] = [
      { propertySize: 'STUDIO', customerPrice: 55, estimatedHours: 2 },
      { propertySize: 'ONE_BED', customerPrice: 70, estimatedHours: 2.5 },
      { propertySize: 'TWO_BED', customerPrice: 90, estimatedHours: 3 },
      { propertySize: 'THREE_BED', customerPrice: 115, estimatedHours: 3.5 },
      { propertySize: 'FOUR_BED', customerPrice: 145, estimatedHours: 4.5 },
      { propertySize: 'FIVE_PLUS', customerPrice: 180, estimatedHours: 5.5 },
    ];
    for (const fp of airbnbPrices) {
      await prisma.fixedServicePrice.upsert({
        where: {
          serviceTypeId_propertySize: {
            serviceTypeId: airbnbService.id,
            propertySize: fp.propertySize,
          },
        },
        update: { customerPrice: fp.customerPrice, estimatedHours: fp.estimatedHours },
        create: { serviceTypeId: airbnbService.id, ...fp },
      });
    }
    console.log('  Airbnb fixed prices seeded');
  }

  // ─── Service Add-ons ──────────────────────────────────────
  if (eotService) {
    const eotAddons = [
      { name: 'Oven clean', price: 35 },
      { name: 'Fridge clean', price: 25 },
      { name: 'Interior windows', price: 30 },
      { name: 'Carpet steam clean (per room)', price: 40 },
    ];
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
    console.log('  EOT add-ons seeded');
  }

  if (airbnbService) {
    const airbnbAddons = [
      { name: 'Linen change', price: 15 },
      { name: 'Welcome pack setup', price: 10 },
      { name: 'Fridge restock check', price: 10 },
    ];
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
    console.log('  Airbnb add-ons seeded');
  }

  // ─── Sample Booking ────────────────────────────────────────
  const mariaCleaner = await prisma.user.findUnique({ where: { email: 'maria@example.com' } });
  if (mariaCleaner) {
    await prisma.booking.upsert({
      where: { id: 'seed-booking-1' },
      update: {},
      create: {
        id: 'seed-booking-1',
        clientId: client.id,
        cleanerId: mariaCleaner.id,
        addressId: 'seed-address-1',
        serviceType: 'regular',
        status: 'COMPLETED',
        date: new Date('2026-03-15'),
        startTime: '10:00',
        duration: 3,
        totalPrice: 63.54,
        platformFee: 3.54,
        cleanerEarnings: 54.0,
        completedAt: new Date('2026-03-15T13:00:00Z'),
      },
    });

    // Sample review
    await prisma.review.upsert({
      where: { bookingId: 'seed-booking-1' },
      update: {},
      create: {
        bookingId: 'seed-booking-1',
        clientId: client.id,
        cleanerId: mariaCleaner.id,
        rating: 5.0,
        thoroughness: 5.0,
        punctuality: 5.0,
        communication: 4.5,
        text: 'Maria was absolutely fantastic! My flat has never looked this clean. She was punctual, thorough, and very friendly.',
      },
    });
    console.log('  Sample booking and review seeded');
  }

  console.log('\nSeed complete!');
  console.log('\nTest accounts:');
  console.log('  Admin:   admin@rena.com / admin123');
  console.log('  Client:  sarah@example.com / password123');
  console.log('  Cleaner: maria@example.com / password123');
  console.log('  Cleaner: katarzyna@example.com / password123');
  console.log('  Cleaner: elena@example.com / password123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
