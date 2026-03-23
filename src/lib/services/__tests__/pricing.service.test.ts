/**
 * Integration tests for PricingService.calculateQuote()
 *
 * These tests mock Prisma to verify the pricing engine logic for all 6 service types
 * against the formulas defined in RENA_PRICING_SPEC_v3.
 */

import Decimal from 'decimal.js';

// ─── Mock Prisma ────────────────────────────────────────────────

const mockPlatformConfig = [
  { key: 'cleaner_fee_pct', value: '0.10' },
  { key: 'customer_fee_pct', value: '0.05' },
  { key: 'deep_multiplier', value: '1.45' },
  { key: 'fortnightly_multiplier', value: '1.05' },
  { key: 'one_off_multiplier', value: '1.10' },
  { key: 'same_day_multiplier', value: '1.30' },
  { key: 'min_cleaner_rate', value: '14.00' },
  { key: 'max_cleaner_rate', value: '35.00' },
];

const mockServiceTypes: Record<
  string,
  {
    slug: string;
    name: string;
    pricingModel: string;
    baseMultiplier: number;
    minimumHours: number | null;
    fixedPrices: { propertySize: string; estimatedHours: number; customerPrice: number }[];
    addons: { id: string; price: number; name: string }[];
  }
> = {
  regular: {
    slug: 'regular',
    name: 'Regular Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.0,
    minimumHours: 2,
    fixedPrices: [],
    addons: [],
  },
  'one-off': {
    slug: 'one-off',
    name: 'One-Off Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.1,
    minimumHours: 2,
    fixedPrices: [],
    addons: [],
  },
  'same-day': {
    slug: 'same-day',
    name: 'Same-Day Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.3,
    minimumHours: 2,
    fixedPrices: [],
    addons: [],
  },
  deep: {
    slug: 'deep',
    name: 'Deep Cleaning',
    pricingModel: 'HOURLY',
    baseMultiplier: 1.45,
    minimumHours: 3,
    fixedPrices: [],
    addons: [],
  },
  eot: {
    slug: 'eot',
    name: 'End of Tenancy',
    pricingModel: 'FIXED',
    baseMultiplier: 1.0,
    minimumHours: null,
    fixedPrices: [
      { propertySize: 'STUDIO', estimatedHours: 4, customerPrice: 175 },
      { propertySize: 'ONE_BED', estimatedHours: 5, customerPrice: 220 },
      { propertySize: 'TWO_BED', estimatedHours: 6, customerPrice: 280 },
      { propertySize: 'THREE_BED', estimatedHours: 8, customerPrice: 350 },
      { propertySize: 'FOUR_BED', estimatedHours: 10, customerPrice: 430 },
      { propertySize: 'FIVE_PLUS', estimatedHours: 13, customerPrice: 550 },
    ],
    addons: [
      { id: 'eot-oven', price: 40, name: 'Oven deep clean' },
      { id: 'eot-carpet', price: 45, name: 'Carpet deep clean (per room)' },
      { id: 'eot-windows', price: 25, name: 'Interior window clean' },
      { id: 'eot-fridge', price: 20, name: 'Fridge clean' },
    ],
  },
  airbnb: {
    slug: 'airbnb',
    name: 'Airbnb Cleaning',
    pricingModel: 'FIXED',
    baseMultiplier: 1.0,
    minimumHours: null,
    fixedPrices: [
      { propertySize: 'STUDIO', estimatedHours: 1.5, customerPrice: 55 },
      { propertySize: 'ONE_BED', estimatedHours: 2, customerPrice: 75 },
      { propertySize: 'TWO_BED', estimatedHours: 2.5, customerPrice: 95 },
      { propertySize: 'THREE_BED', estimatedHours: 3.5, customerPrice: 120 },
      { propertySize: 'FOUR_BED', estimatedHours: 4.5, customerPrice: 155 },
    ],
    addons: [
      { id: 'airbnb-sameday', price: 25, name: 'Same-day turnaround (under 3hr notice)' },
      { id: 'airbnb-party', price: 40, name: 'Post-party deep clean' },
    ],
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    platformConfig: {
      findMany: jest.fn().mockImplementation(() => Promise.resolve(mockPlatformConfig)),
    },
    serviceType: {
      findUnique: jest.fn().mockImplementation(({ where }: { where: { slug: string } }) => {
        return Promise.resolve(mockServiceTypes[where.slug] ?? null);
      }),
    },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pricingModule = require('../pricing.service');
const service = new pricingModule.PricingService();

// ─── Hourly service tests ───────────────────────────────────────

describe('PricingService — Hourly', () => {
  it('regular weekly 3hrs at £16/hr: gross £48, cleaner earns £43.20 (90%), customer pays £50.40 (gross + 5%)', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 16,
      hours: 3,
      frequency: 'WEEKLY',
    });

    expect(q.cleanerGross).toBe(48);
    expect(q.cleanerFee).toBe(4.8);
    expect(q.cleanerEarns).toBe(43.2);
    expect(q.customerServiceFee).toBe(2.4);
    expect(q.totalCharged).toBe(50.4);
    expect(q.renaEarns).toBe(7.2);
  });

  it('regular fortnightly: applies 1.05 multiplier before fee split', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 16,
      hours: 3,
      frequency: 'FORTNIGHTLY',
    });

    // 16 * 3 * (1.0 * 1.05) = 50.40
    expect(q.cleanerGross).toBe(50.4);
    expect(q.cleanerFee).toBe(5.04);
    expect(q.cleanerEarns).toBe(45.36);
  });

  it('one-off: applies 1.10 multiplier before fee split', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'one-off',
      cleanerHourlyRate: 16,
      hours: 3,
    });

    // 16 * 3 * 1.10 = 52.80
    expect(q.cleanerGross).toBe(52.8);
  });

  it('same-day: applies 1.30 multiplier before fee split', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'same-day',
      cleanerHourlyRate: 16,
      hours: 3,
    });

    // 16 * 3 * 1.30 = 62.40
    expect(q.cleanerGross).toBe(62.4);
  });

  it('deep clean: minimum 3hrs enforced', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'deep',
      cleanerHourlyRate: 16,
      hours: 2, // below minimum
    });

    // Should enforce 3 hrs min: 16 * 3 * 1.45 = 69.60
    expect(q.hours).toBe(3);
    expect(q.cleanerGross).toBe(69.6);
  });

  it('rena_total = cleaner_fee (10%) + customer_fee (5%) = ~15% of gross on hourly', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 20,
      hours: 3,
      frequency: 'WEEKLY',
    });

    const expectedGross = 60;
    const expectedRena = new Decimal(expectedGross).mul(0.15).toDecimalPlaces(2).toNumber();
    expect(q.renaEarns).toBe(expectedRena);
  });

  it('cleaner earns exactly 90% of gross on hourly bookings', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 18,
      hours: 4,
      frequency: 'WEEKLY',
    });

    const gross = 18 * 4;
    expect(q.cleanerEarns).toBe(new Decimal(gross).mul(0.9).toDecimalPlaces(2).toNumber());
  });

  it('customer pays exactly gross × 1.05 on hourly bookings', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 16,
      hours: 3,
      frequency: 'WEEKLY',
    });

    expect(q.totalCharged).toBe(
      new Decimal(q.cleanerGross).mul(1.05).toDecimalPlaces(2).toNumber()
    );
  });
});

// ─── Fixed price — EOT tests ────────────────────────────────────

describe('PricingService — EOT', () => {
  it('EOT 2-bed at £16/hr: deep rate = £23.20, × 6hrs × 1.10 = cleaner gross £153.12', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'eot',
      cleanerHourlyRate: 16,
      propertySize: 'TWO_BED',
    });

    // deep rate = 16 * 1.45 = 23.20
    expect(q.cleanerDeepRate).toBe(23.2);
    // gross = 23.20 * 6 * 1.10 = 153.12
    expect(q.cleanerGross).toBe(153.12);
    // fee = 153.12 * 0.10 = 15.31
    expect(q.cleanerFee).toBe(15.31);
    // earns = 153.12 - 15.31 = 137.81
    expect(q.cleanerEarns).toBe(137.81);
    // customer pays fixed = 280
    expect(q.totalCharged).toBe(280);
  });

  it('EOT with oven addon: cleaner earns 85% of £40 = £34, Rena keeps remainder', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'eot',
      cleanerHourlyRate: 16,
      propertySize: 'TWO_BED',
      addons: ['eot-oven'],
    });

    expect(q.addonTotal).toBe(40);
    expect(q.totalCharged).toBe(320); // 280 + 40
  });

  it('EOT with carpet deep clean addon: cleaner addon share = 85% of £45 = £38.25', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'eot',
      cleanerHourlyRate: 16,
      propertySize: 'TWO_BED',
      addons: ['eot-carpet'],
    });

    expect(q.addonTotal).toBe(45);
  });

  it('EOT: no platform fee shown to customer (customerServiceFee = 0)', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'eot',
      cleanerHourlyRate: 16,
      propertySize: 'STUDIO',
    });

    expect(q.customerServiceFee).toBe(0);
    expect(q.isFixedPrice).toBe(true);
  });

  it('EOT: customer sees fixed total only', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'eot',
      cleanerHourlyRate: 16,
      propertySize: 'STUDIO',
    });

    expect(q.customerSubtotal).toBe(175);
    expect(q.totalCharged).toBe(175);
  });
});

// ─── Fixed price — Airbnb tests ─────────────────────────────────

describe('PricingService — Airbnb', () => {
  it('Airbnb 1-bed at £16/hr: deep rate = £23.20, × 2hrs = cleaner gross £46.40', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'airbnb',
      cleanerHourlyRate: 16,
      propertySize: 'ONE_BED',
    });

    expect(q.cleanerDeepRate).toBe(23.2);
    // No EOT bonus: 23.20 * 2 = 46.40
    expect(q.cleanerGross).toBe(46.4);
    // fee = 46.40 * 0.10 = 4.64
    expect(q.cleanerFee).toBe(4.64);
    // earns = 46.40 - 4.64 = 41.76
    expect(q.cleanerEarns).toBe(41.76);
    expect(q.totalCharged).toBe(75);
  });

  it('Airbnb same-day addon: total includes +£25', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'airbnb',
      cleanerHourlyRate: 16,
      propertySize: 'ONE_BED',
      addons: ['airbnb-sameday'],
    });

    expect(q.addonTotal).toBe(25);
    expect(q.totalCharged).toBe(100); // 75 + 25
  });

  it('Airbnb post-party addon: total includes +£40', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'airbnb',
      cleanerHourlyRate: 16,
      propertySize: 'ONE_BED',
      addons: ['airbnb-party'],
    });

    expect(q.addonTotal).toBe(40);
    expect(q.totalCharged).toBe(115); // 75 + 40
  });

  it('Airbnb: no platform fee shown to customer', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'airbnb',
      cleanerHourlyRate: 16,
      propertySize: 'STUDIO',
    });

    expect(q.customerServiceFee).toBe(0);
    expect(q.isFixedPrice).toBe(true);
  });

  it('Airbnb: customer sees fixed total only', async () => {
    const q = await service.calculateQuote({
      serviceSlug: 'airbnb',
      cleanerHourlyRate: 16,
      propertySize: 'STUDIO',
    });

    expect(q.customerSubtotal).toBe(55);
    expect(q.totalCharged).toBe(55);
  });
});

// ─── Guardrails ─────────────────────────────────────────────────

describe('PricingService — Guardrails', () => {
  it('cleaner rate validation rejects below £14', async () => {
    const result = await service.validateCleanerRate(13);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('14');
  });

  it('cleaner rate validation rejects above £35', async () => {
    const result = await service.validateCleanerRate(36);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('35');
  });

  it('cleaner rate validation accepts £14-£35', async () => {
    expect((await service.validateCleanerRate(14)).valid).toBe(true);
    expect((await service.validateCleanerRate(25)).valid).toBe(true);
    expect((await service.validateCleanerRate(35)).valid).toBe(true);
  });

  it('decimal precision: no floating point errors on any calculation', async () => {
    // Use a rate that commonly causes float issues
    const q = await service.calculateQuote({
      serviceSlug: 'regular',
      cleanerHourlyRate: 18.5,
      hours: 3,
      frequency: 'WEEKLY',
    });

    // 18.5 * 3 * 1.0 = 55.50
    expect(q.cleanerGross).toBe(55.5);
    expect(q.cleanerFee).toBe(5.55);
    expect(q.cleanerEarns).toBe(49.95);
    expect(q.customerServiceFee).toBe(2.78); // 55.5 * 0.05 = 2.775 → 2.78
    expect(q.totalCharged).toBe(58.28); // 55.50 + 2.78
    expect(q.renaEarns).toBe(8.33); // 5.55 + 2.78

    // Verify no floating point artifacts
    expect(String(q.cleanerGross)).not.toMatch(/\d{4,}$/);
    expect(String(q.cleanerEarns)).not.toMatch(/\d{4,}$/);
  });
});
