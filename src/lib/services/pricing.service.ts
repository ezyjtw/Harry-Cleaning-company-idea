import { PLATFORM_COMMISSION_PERCENT, SERVICE_FEE_PERCENT } from '@/lib/pricing';

// ─── Types ──────────────────────────────────────────────────────

export interface PricingInput {
  baseRate: number; // displayed rate (already includes margin)
  duration: number; // hours
  serviceType: string;
  rooms?: { bedrooms: number; bathrooms: number; kitchen: boolean; livingAreas: number };
  extras?: string[];
  postcode?: string;
  cleanerTier?: string;
  isUrgent?: boolean;
  isSameDay?: boolean;
}

export interface PricingBreakdown {
  baseAmount: number;
  roomMultiplier: number;
  serviceMultiplier: number;
  extrasAmount: number;
  locationMultiplier: number;
  surgeMultiplier: number;
  tierPremium: number;
  urgentFee: number;
  travelFee: number;
  subtotal: number;
  platformCommission: number;
  platformCommissionPercent: number;
  serviceFee: number;
  serviceFeePercent: number;
  cleanerEarnings: number;
  total: number;
  savings?: number;
  appliedDiscounts: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const SERVICE_MULTIPLIERS: Record<string, number> = {
  standard: 1.0,
  regular: 1.0,
  deep: 1.5,
  'end-of-tenancy': 1.8,
  'move-in': 1.6,
  'move-out': 1.6,
  airbnb: 1.2,
  office: 1.2,
  'same-day': 1.4,
  'last-minute': 1.5,
};

const ROOM_MULTIPLIERS = {
  bedroom: { base: 0.15, perRoom: 0.15 },
  bathroom: { base: 0.2, perRoom: 0.2 },
  kitchen: 0.1,
  livingArea: { base: 0.1, perRoom: 0.1 },
};

const EXTRA_PRICES: Record<string, number> = {
  'inside-oven': 15,
  'inside-fridge': 10,
  windows: 20,
  laundry: 15,
  'organize-closets': 25,
  'wall-marks': 10,
  balcony: 12,
  garage: 20,
  ironing: 15,
  'carpet-cleaning': 30,
};

const TIER_PREMIUMS: Record<string, number> = {
  STARTER: 0,
  BRONZE: 0.05,
  SILVER: 0.1,
  GOLD: 0.15,
  ELITE: 0.25,
};

const LOCATION_ZONES: Record<string, number> = {
  EC: 1.3,
  WC: 1.3,
  W1: 1.25,
  SW1: 1.3,
  N1: 1.15,
  E1: 1.15,
  SE1: 1.15,
  SW3: 1.2,
  SW7: 1.2,
  W8: 1.2,
  NW1: 1.15,
  NW3: 1.2,
  N: 1.1,
  E: 1.1,
  SE: 1.1,
  SW: 1.1,
  W: 1.1,
  NW: 1.1,
  BR: 1.0,
  CR: 1.0,
  DA: 1.0,
  EN: 1.0,
  HA: 1.0,
  IG: 1.0,
  KT: 1.0,
  RM: 1.0,
  SM: 1.0,
  TW: 1.0,
  UB: 1.0,
};

const URGENT_FEE_PERCENT = 0.2;

// ─── Service ────────────────────────────────────────────────────

export class PricingService {
  /**
   * Calculate full pricing breakdown.
   * baseRate is the displayed rate (margin already baked in).
   * The total shown to the customer is simply the computed amount.
   * Internally we extract cleaner earnings and platform fee.
   */
  static calculate(input: PricingInput): PricingBreakdown {
    const appliedDiscounts: string[] = [];

    // 1. Base amount (displayed rate × hours)
    const baseAmount = input.baseRate * input.duration;

    // 2. Room multiplier
    let roomMultiplier = 1.0;
    if (input.rooms) {
      const bedroomExtra = Math.max(0, input.rooms.bedrooms - 1) * ROOM_MULTIPLIERS.bedroom.perRoom;
      const bathroomExtra =
        Math.max(0, input.rooms.bathrooms - 1) * ROOM_MULTIPLIERS.bathroom.perRoom;
      const kitchenExtra = input.rooms.kitchen ? ROOM_MULTIPLIERS.kitchen : 0;
      const livingExtra =
        Math.max(0, input.rooms.livingAreas - 1) * ROOM_MULTIPLIERS.livingArea.perRoom;
      roomMultiplier = 1.0 + bedroomExtra + bathroomExtra + kitchenExtra + livingExtra;
    }

    // 3. Service type multiplier
    const serviceMultiplier = SERVICE_MULTIPLIERS[input.serviceType] ?? 1.0;

    // 4. Extras
    let extrasAmount = 0;
    if (input.extras) {
      for (const extra of input.extras) {
        extrasAmount += EXTRA_PRICES[extra] ?? 0;
      }
    }

    // 5. Location multiplier
    let locationMultiplier = 1.0;
    if (input.postcode) {
      locationMultiplier = this.getLocationMultiplier(input.postcode);
    }

    // 6. Surge pricing
    const surgeMultiplier = this.getSurgeMultiplier();

    // 7. Tier premium
    let tierPremium = 0;
    if (input.cleanerTier) {
      const premiumPercent = TIER_PREMIUMS[input.cleanerTier] ?? 0;
      tierPremium = baseAmount * premiumPercent;
    }

    // 8. Urgent/same-day fee
    let urgentFee = 0;
    if (input.isUrgent || input.isSameDay) {
      urgentFee = baseAmount * URGENT_FEE_PERCENT;
    }

    // Cleaner earnings (base amount adjusted by all multipliers)
    const cleanerEarnings =
      Math.round(
        (baseAmount * roomMultiplier * serviceMultiplier * locationMultiplier * surgeMultiplier +
          extrasAmount +
          tierPremium +
          urgentFee) *
          100
      ) / 100;

    // 10% platform commission on cleaner earnings
    const platformCommission =
      Math.round(cleanerEarnings * (PLATFORM_COMMISSION_PERCENT / 100) * 100) / 100;
    const subtotal = Math.round((cleanerEarnings + platformCommission) * 100) / 100;

    // 5% service fee to customer on subtotal
    const serviceFee = Math.round(subtotal * (SERVICE_FEE_PERCENT / 100) * 100) / 100;
    const total = Math.round((subtotal + serviceFee) * 100) / 100;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      roomMultiplier,
      serviceMultiplier,
      extrasAmount,
      locationMultiplier,
      surgeMultiplier,
      tierPremium: Math.round(tierPremium * 100) / 100,
      urgentFee: Math.round(urgentFee * 100) / 100,
      travelFee: 0,
      subtotal,
      platformCommission,
      platformCommissionPercent: PLATFORM_COMMISSION_PERCENT,
      serviceFee,
      serviceFeePercent: SERVICE_FEE_PERCENT,
      cleanerEarnings,
      total,
      appliedDiscounts,
    };
  }

  static getLocationMultiplier(postcode: string): number {
    const prefix = postcode.toUpperCase().replace(/\s+/g, '');
    for (const [zone, multiplier] of Object.entries(LOCATION_ZONES)) {
      if (prefix.startsWith(zone)) {
        return multiplier;
      }
    }
    return 1.0;
  }

  static getSurgeMultiplier(): number {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    const isPeakHour = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16);
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isPeakHour && isWeekday) return 1.1;
    if (dayOfWeek === 0) return 1.15;
    return 1.0;
  }

  /**
   * Get a price estimate range for the hero widget and estimates
   */
  static getEstimateRange(input: PricingInput): {
    min: number;
    max: number;
    average: number;
    estimatedHours: number;
    cleanerCount?: number;
  } {
    const breakdown = this.calculate(input);
    const min = Math.round(breakdown.total * 0.9 * 100) / 100;
    const max = Math.round(breakdown.total * 1.1 * 100) / 100;

    // Estimate hours from rooms
    let estimatedHours = input.duration;
    if (input.rooms) {
      estimatedHours = Math.max(2, input.rooms.bedrooms * 0.5 + input.rooms.bathrooms * 0.75 + 1);
    }

    return { min, max, average: breakdown.total, estimatedHours };
  }

  static getComparisonPricing(total: number): {
    rena: number;
    typicalAgency: number;
    otherPlatforms: number;
    savings: number;
  } {
    const agencyMultiplier = 1.35;
    const otherPlatformMultiplier = 1.2;

    return {
      rena: total,
      typicalAgency: Math.round(total * agencyMultiplier * 100) / 100,
      otherPlatforms: Math.round(total * otherPlatformMultiplier * 100) / 100,
      savings: Math.round(total * (agencyMultiplier - 1) * 100) / 100,
    };
  }
}
