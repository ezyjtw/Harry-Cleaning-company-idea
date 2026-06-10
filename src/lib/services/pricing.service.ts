import Decimal from 'decimal.js';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────

export type ServiceSlug = 'regular' | 'same-day' | 'deep' | 'eot' | 'airbnb';

export type EotPropertySize = 'studio' | '1bed' | '2bed' | '3bed' | '4bed' | '5bedPlus';
export type AirbnbPropertySize = 'studio' | '1bed' | '2bed' | '3bed' | '4bedPlus';

const FIXED_SERVICES: ServiceSlug[] = ['eot', 'airbnb'];

const COMMISSION_RATES: Record<ServiceSlug, number> = {
  regular: 0.1,
  'same-day': 0.1,
  deep: 0.1,
  eot: 0.15,
  airbnb: 0.15,
};

const PLATFORM_FEE_RATE = 0.06;

export const PRICE_ABSORPTION_THRESHOLD = 3.0;

export const EOT_PRICE_FLOORS: Record<EotPropertySize, number> = {
  studio: 75,
  '1bed': 95,
  '2bed': 125,
  '3bed': 160,
  '4bed': 195,
  '5bedPlus': 240,
};

export const AIRBNB_PRICE_FLOORS: Record<AirbnbPropertySize, number> = {
  studio: 22.5,
  '1bed': 27.5,
  '2bed': 37.5,
  '3bed': 47.5,
  '4bedPlus': 65,
};

export const EOT_GUIDE_RANGES: Record<EotPropertySize, { min: number; max: number }> = {
  studio: { min: 150, max: 200 },
  '1bed': { min: 190, max: 240 },
  '2bed': { min: 250, max: 300 },
  '3bed': { min: 320, max: 380 },
  '4bed': { min: 390, max: 450 },
  '5bedPlus': { min: 480, max: 580 },
};

export const AIRBNB_GUIDE_RANGES: Record<AirbnbPropertySize, { min: number; max: number }> = {
  studio: { min: 45, max: 65 },
  '1bed': { min: 55, max: 85 },
  '2bed': { min: 75, max: 110 },
  '3bed': { min: 95, max: 140 },
  '4bedPlus': { min: 130, max: 165 },
};

export const MIN_HOURLY_RATE = 14;

export interface CleanerQuoteInput {
  cleanerId: string;
  serviceSlug: ServiceSlug;
  hours?: number;
  propertySize?: string;
  addons?: string[];
}

export interface QuoteResult {
  serviceType: string;
  isFixedPrice: boolean;
  hours: number | null;
  propertySize: string | null;
  commissionRate: number;

  cleanerListedPrice: number;
  cleanerCommission: number;
  cleanerPayout: number;

  customerPlatformFee: number;
  customerTotal: number;

  addonTotal: number;
  breakdown: string;
}

export interface AreaQuoteResult {
  serviceType: string;
  isFixedPrice: boolean;
  cleanerCount: number;
  minTotal: number;
  maxTotal: number;
  minCleanerPrice: number;
  maxCleanerPrice: number;
}

// ─── Service ────────────────────────────────────────────────────

export class PricingService {
  async calculateQuote(input: CleanerQuoteInput): Promise<QuoteResult> {
    const profile = await prisma.cleanerProfile.findFirst({
      where: { userId: input.cleanerId },
      select: {
        hourlyRateRegular: true,
        hourlyRateDeep: true,
        hourlyRateSameDay: true,
        eotPrices: true,
        airbnbPrices: true,
        serviceTypes: true,
      },
    });

    if (!profile) throw new Error('Cleaner not found');

    const commissionRate = COMMISSION_RATES[input.serviceSlug];
    const isFixed = FIXED_SERVICES.includes(input.serviceSlug);

    if (isFixed) {
      return this.calculateFixedQuote(input, profile, commissionRate);
    }
    return this.calculateHourlyQuote(input, profile, commissionRate);
  }

  private async calculateHourlyQuote(
    input: CleanerQuoteInput,
    profile: {
      hourlyRateRegular: Decimal | null;
      hourlyRateDeep: Decimal | null;
      hourlyRateSameDay: Decimal | null;
      serviceTypes: string[];
    },
    commissionRate: number
  ): Promise<QuoteResult> {
    if (!input.hours) throw new Error('hours required for hourly services');

    const serviceType = await prisma.serviceType.findUnique({
      where: { slug: input.serviceSlug },
      include: { addons: true },
    });
    if (!serviceType) throw new Error(`Unknown service: ${input.serviceSlug}`);

    const minHours = serviceType.minimumHours ?? 2;
    const hours = Math.max(input.hours, minHours);

    const rateField = this.getHourlyRateField(input.serviceSlug);
    const rateValue = profile[rateField as keyof typeof profile] as Decimal | null;
    if (!rateValue) {
      throw new Error(`This cleaner has not set a rate for ${input.serviceSlug} cleaning`);
    }
    const hourlyRate = Number(rateValue);

    const cleanerListedPrice = new Decimal(hourlyRate).mul(hours).toDecimalPlaces(2).toNumber();

    const cleanerCommission = new Decimal(cleanerListedPrice)
      .mul(commissionRate)
      .toDecimalPlaces(2)
      .toNumber();

    const cleanerPayout = new Decimal(cleanerListedPrice)
      .minus(cleanerCommission)
      .toDecimalPlaces(2)
      .toNumber();

    const addonTotal = this.calcAddonTotal(input.addons ?? [], serviceType.addons);

    const customerPlatformFee = new Decimal(cleanerListedPrice)
      .plus(addonTotal)
      .mul(PLATFORM_FEE_RATE)
      .toDecimalPlaces(2)
      .toNumber();

    const customerTotal = new Decimal(cleanerListedPrice)
      .plus(customerPlatformFee)
      .plus(addonTotal)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      serviceType: serviceType.name,
      isFixedPrice: false,
      hours,
      propertySize: null,
      commissionRate,
      cleanerListedPrice,
      cleanerCommission,
      cleanerPayout,
      customerPlatformFee,
      customerTotal,
      addonTotal,
      breakdown: `${hours} hrs × £${hourlyRate}/hr = £${cleanerListedPrice}. Commission ${(commissionRate * 100).toFixed(0)}%: £${cleanerCommission}. Cleaner payout: £${cleanerPayout}. Platform fee 6%: £${customerPlatformFee}. Customer total: £${customerTotal}.`,
    };
  }

  private async calculateFixedQuote(
    input: CleanerQuoteInput,
    profile: {
      eotPrices: unknown;
      airbnbPrices: unknown;
      serviceTypes: string[];
    },
    commissionRate: number
  ): Promise<QuoteResult> {
    if (!input.propertySize) {
      throw new Error('propertySize required for fixed-price services');
    }

    const serviceType = await prisma.serviceType.findUnique({
      where: { slug: input.serviceSlug },
      include: { addons: true },
    });
    if (!serviceType) throw new Error(`Unknown service: ${input.serviceSlug}`);

    const prices =
      input.serviceSlug === 'eot'
        ? (profile.eotPrices as Record<string, number> | null)
        : (profile.airbnbPrices as Record<string, number> | null);

    if (!prices) {
      throw new Error(`This cleaner has not set prices for ${input.serviceSlug} cleaning`);
    }

    const cleanerListedPrice = prices[input.propertySize];
    if (!cleanerListedPrice || cleanerListedPrice <= 0) {
      throw new Error(
        `This cleaner has not set a price for ${input.propertySize} in ${input.serviceSlug} cleaning`
      );
    }

    const cleanerCommission = new Decimal(cleanerListedPrice)
      .mul(commissionRate)
      .toDecimalPlaces(2)
      .toNumber();

    const cleanerPayout = new Decimal(cleanerListedPrice)
      .minus(cleanerCommission)
      .toDecimalPlaces(2)
      .toNumber();

    const addonTotal = this.calcAddonTotal(input.addons ?? [], serviceType.addons);

    const customerPlatformFee = new Decimal(cleanerListedPrice)
      .plus(addonTotal)
      .mul(PLATFORM_FEE_RATE)
      .toDecimalPlaces(2)
      .toNumber();

    const customerTotal = new Decimal(cleanerListedPrice)
      .plus(customerPlatformFee)
      .plus(addonTotal)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      serviceType: serviceType.name,
      isFixedPrice: true,
      hours: null,
      propertySize: input.propertySize,
      commissionRate,
      cleanerListedPrice,
      cleanerCommission,
      cleanerPayout,
      customerPlatformFee,
      customerTotal,
      addonTotal,
      breakdown: `Fixed price £${cleanerListedPrice} (${input.propertySize}). Commission ${(commissionRate * 100).toFixed(0)}%: £${cleanerCommission}. Cleaner payout: £${cleanerPayout}. Platform fee 6%: £${customerPlatformFee}. Customer total: £${customerTotal}.`,
    };
  }

  async calculateAreaQuote(params: {
    postcode: string;
    serviceSlug: ServiceSlug;
    hours?: number;
    propertySize?: string;
  }): Promise<AreaQuoteResult> {
    const { lookupPostcode } = await import('@/lib/utils/postcode');
    const geo = await lookupPostcode(params.postcode);

    const isFixed = FIXED_SERVICES.includes(params.serviceSlug);

    const serviceTypeFilter = this.getServiceTypeFilterValue(params.serviceSlug);

    const where: Record<string, unknown> = {
      verified: true,
      user: { accountStatus: 'ACTIVE', isDeleted: false },
      serviceTypes: { has: serviceTypeFilter },
    };

    if (geo) {
      where.latitude = { not: null };
      where.longitude = { not: null };
    }

    const cleaners = await prisma.cleanerProfile.findMany({
      where,
      select: {
        hourlyRateRegular: true,
        hourlyRateDeep: true,
        hourlyRateSameDay: true,
        eotPrices: true,
        airbnbPrices: true,
        latitude: true,
        longitude: true,
        radius: true,
      },
    });

    let filtered = cleaners;
    if (geo) {
      const { haversineDistance } = await import('@/lib/utils/postcode');
      filtered = cleaners.filter((c) => {
        if (c.latitude === null || c.longitude === null) return false;
        const dist = haversineDistance(geo.latitude, geo.longitude, c.latitude, c.longitude);
        return dist <= c.radius;
      });
    }

    const prices: number[] = [];
    for (const c of filtered) {
      if (isFixed) {
        if (!params.propertySize) continue;
        const priceMap =
          params.serviceSlug === 'eot'
            ? (c.eotPrices as Record<string, number> | null)
            : (c.airbnbPrices as Record<string, number> | null);
        const price = priceMap?.[params.propertySize];
        if (price && price > 0) prices.push(price);
      } else {
        const rateField = this.getHourlyRateField(params.serviceSlug);
        const rate = c[rateField as keyof typeof c] as Decimal | null;
        if (rate) {
          const hourly = Number(rate);
          const hours = params.hours || 2;
          prices.push(hourly * hours);
        }
      }
    }

    if (prices.length === 0) {
      const serviceType = await prisma.serviceType.findUnique({
        where: { slug: params.serviceSlug },
      });
      return {
        serviceType: serviceType?.name || params.serviceSlug,
        isFixedPrice: isFixed,
        cleanerCount: 0,
        minTotal: 0,
        maxTotal: 0,
        minCleanerPrice: 0,
        maxCleanerPrice: 0,
      };
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minFee = new Decimal(minPrice).mul(PLATFORM_FEE_RATE).toDecimalPlaces(2).toNumber();
    const maxFee = new Decimal(maxPrice).mul(PLATFORM_FEE_RATE).toDecimalPlaces(2).toNumber();

    const serviceType = await prisma.serviceType.findUnique({
      where: { slug: params.serviceSlug },
    });

    return {
      serviceType: serviceType?.name || params.serviceSlug,
      isFixedPrice: isFixed,
      cleanerCount: prices.length,
      minTotal: new Decimal(minPrice).plus(minFee).toDecimalPlaces(2).toNumber(),
      maxTotal: new Decimal(maxPrice).plus(maxFee).toDecimalPlaces(2).toNumber(),
      minCleanerPrice: minPrice,
      maxCleanerPrice: maxPrice,
    };
  }

  private getHourlyRateField(serviceSlug: ServiceSlug): string {
    switch (serviceSlug) {
      case 'regular':
        return 'hourlyRateRegular';
      case 'deep':
        return 'hourlyRateDeep';
      case 'same-day':
        return 'hourlyRateSameDay';
      default:
        return 'hourlyRateRegular';
    }
  }

  private getServiceTypeFilterValue(serviceSlug: ServiceSlug): string {
    switch (serviceSlug) {
      case 'regular':
        return 'regular';
      case 'deep':
        return 'deep';
      case 'same-day':
        return 'same_day';
      case 'eot':
        return 'end_of_tenancy';
      case 'airbnb':
        return 'airbnb';
    }
  }

  private async getConfig(): Promise<Record<string, number>> {
    const configs = await prisma.platformConfig.findMany();
    return Object.fromEntries(configs.map((c) => [c.key, parseFloat(c.value)]));
  }

  private calcAddonTotal(addonIds: string[], available: { id: string; price: number }[]): number {
    if (!addonIds.length) return 0;
    const matched = available.filter((a) => addonIds.includes(a.id));
    return matched.reduce((sum, a) => sum + a.price, 0);
  }

  async validateCleanerRate(rate: number): Promise<{ valid: boolean; message?: string }> {
    if (rate < MIN_HOURLY_RATE) {
      return { valid: false, message: `Minimum rate is £${MIN_HOURLY_RATE}/hr` };
    }
    return { valid: true };
  }
}

export const pricingService = new PricingService();

// ─── Same-Day Cutoff ────────────────────────────────────────────

export const isSameDay = (scheduledAt: Date): boolean => {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setHours(12, 0, 0, 0);
  return scheduledAt.toDateString() === now.toDateString() && now < cutoff;
};

// ─── Validation Helpers ─────────────────────────────────────────

export function validateServiceTypePricing(
  serviceTypes: string[],
  data: {
    hourlyRateRegular?: number | null;
    hourlyRateDeep?: number | null;
    hourlyRateSameDay?: number | null;
    eotPrices?: Record<string, number> | null;
    airbnbPrices?: Record<string, number> | null;
  }
): { valid: boolean; error?: string } {
  if (serviceTypes.includes('regular') && !data.hourlyRateRegular) {
    return { valid: false, error: 'hourlyRateRegular is required when offering regular cleaning.' };
  }
  if (serviceTypes.includes('deep') && !data.hourlyRateDeep) {
    return { valid: false, error: 'hourlyRateDeep is required when offering deep cleaning.' };
  }
  if (serviceTypes.includes('same_day') && !data.hourlyRateSameDay) {
    return {
      valid: false,
      error: 'hourlyRateSameDay is required when offering same-day cleaning.',
    };
  }
  // Fixed-price services (end_of_tenancy, airbnb) do NOT require prices at
  // signup time. Cleaners add property-size prices later from the pricing
  // dashboard. Until prices are set the cleaner simply won't appear in
  // fixed-price search results or be bookable for those services — enforced
  // by the search API (requires prices) and booking API (server-side quote).
  return { valid: true };
}

export function validatePriceFloors(
  data: {
    hourlyRateRegular?: number | null;
    hourlyRateDeep?: number | null;
    hourlyRateSameDay?: number | null;
    eotPrices?: Record<string, number> | null;
    airbnbPrices?: Record<string, number> | null;
  },
  serviceTypes?: string[]
): { valid: boolean; error?: string } {
  const hourlyFields = [
    {
      key: 'hourlyRateRegular',
      service: 'regular',
      label: 'Regular hourly rate',
      value: data.hourlyRateRegular,
    },
    {
      key: 'hourlyRateDeep',
      service: 'deep',
      label: 'Deep clean hourly rate',
      value: data.hourlyRateDeep,
    },
    {
      key: 'hourlyRateSameDay',
      service: 'same_day',
      label: 'Same-day hourly rate',
      value: data.hourlyRateSameDay,
    },
  ];

  for (const field of hourlyFields) {
    if (serviceTypes && !serviceTypes.includes(field.service)) continue;
    if (field.value !== null && field.value !== undefined && field.value < MIN_HOURLY_RATE) {
      return {
        valid: false,
        error: `${field.label} must be at least £${MIN_HOURLY_RATE}/hr.`,
      };
    }
  }

  if (data.eotPrices) {
    for (const [size, price] of Object.entries(data.eotPrices)) {
      if (price <= 0) continue;
      const floor = EOT_PRICE_FLOORS[size as EotPropertySize];
      if (floor && price < floor) {
        return {
          valid: false,
          error: `End of Tenancy price for ${size} must be at least £${floor}. You entered £${price}.`,
        };
      }
    }
  }

  if (data.airbnbPrices) {
    for (const [size, price] of Object.entries(data.airbnbPrices)) {
      if (price <= 0) continue;
      const floor = AIRBNB_PRICE_FLOORS[size as AirbnbPropertySize];
      if (floor && price < floor) {
        return {
          valid: false,
          error: `Airbnb price for ${size} must be at least £${floor}. You entered £${price}.`,
        };
      }
    }
  }

  return { valid: true };
}
