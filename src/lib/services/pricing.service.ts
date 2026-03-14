import { PLATFORM_FEE_PERCENT } from '@/lib/pricing';

// ─── Types ──────────────────────────────────────────────────────

export interface PricingInput {
  baseRate: number; // cleaner's hourly rate
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
  platformFee: number;
  cleanerEarnings: number;
  total: number;
  savings?: number;
  appliedDiscounts: string[];
}

// ─── Constants ──────────────────────────────────────────────────

const SERVICE_MULTIPLIERS: Record<string, number> = {
  standard: 1.0,
  deep: 1.5,
  'end-of-tenancy': 1.8,
  'move-in': 1.6,
  'move-out': 1.6,
  airbnb: 1.3,
  office: 1.2,
  'same-day': 1.4,
  'last-minute': 1.5,
};

const ROOM_MULTIPLIERS = {
  bedroom: { base: 0.15, perRoom: 0.15 }, // 15% per bedroom
  bathroom: { base: 0.2, perRoom: 0.2 }, // 20% per bathroom (more intensive)
  kitchen: 0.1, // 10% for kitchen
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
  BRONZE: 0.05, // 5% premium
  SILVER: 0.1, // 10% premium
  GOLD: 0.15, // 15% premium
  ELITE: 0.25, // 25% premium
};

const LOCATION_ZONES: Record<string, number> = {
  // Central London
  EC: 1.3,
  WC: 1.3,
  W1: 1.25,
  SW1: 1.3,
  // Inner London
  N1: 1.15,
  E1: 1.15,
  SE1: 1.15,
  SW3: 1.2,
  SW7: 1.2,
  W8: 1.2,
  NW1: 1.15,
  NW3: 1.2,
  // Mid London
  N: 1.1,
  E: 1.1,
  SE: 1.1,
  SW: 1.1,
  W: 1.1,
  NW: 1.1,
  // Outer London
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

const URGENT_FEE_PERCENT = 0.2; // 20% for same-day bookings

// ─── Service ────────────────────────────────────────────────────

export class PricingService {
  /**
   * Calculate full pricing breakdown
   */
  static calculate(input: PricingInput): PricingBreakdown {
    const appliedDiscounts: string[] = [];

    // 1. Base amount
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

    // 6. Surge pricing (time-based demand)
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

    // Calculate subtotal (cleaner earnings before platform fee)
    const subtotal =
      Math.round(
        (baseAmount * roomMultiplier * serviceMultiplier * locationMultiplier * surgeMultiplier +
          extrasAmount +
          tierPremium +
          urgentFee) *
          100
      ) / 100;

    // Platform fee
    const platformFee = Math.round(subtotal * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;
    const cleanerEarnings = subtotal;
    const total = Math.round((subtotal + platformFee) * 100) / 100;

    return {
      baseAmount: Math.round(baseAmount * 100) / 100,
      roomMultiplier,
      serviceMultiplier,
      extrasAmount,
      locationMultiplier,
      surgeMultiplier,
      tierPremium: Math.round(tierPremium * 100) / 100,
      urgentFee: Math.round(urgentFee * 100) / 100,
      travelFee: 0, // Set by travel service
      subtotal,
      platformFee,
      cleanerEarnings,
      total,
      appliedDiscounts,
    };
  }

  /**
   * Get location-based pricing multiplier from postcode
   */
  static getLocationMultiplier(postcode: string): number {
    const prefix = postcode.toUpperCase().replace(/\s+/g, '');

    // Try exact match first (e.g., "SW1")
    for (const [zone, multiplier] of Object.entries(LOCATION_ZONES)) {
      if (prefix.startsWith(zone)) {
        return multiplier;
      }
    }

    return 1.0; // Default for unknown areas
  }

  /**
   * Get demand-based surge multiplier
   */
  static getSurgeMultiplier(): number {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();

    // Peak hours: 9-11am and 2-4pm weekdays
    const isPeakHour = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16);
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

    if (isPeakHour && isWeekday) return 1.1; // 10% surge
    if (dayOfWeek === 0) return 1.15; // Sunday premium
    return 1.0;
  }

  /**
   * Get a price estimate range
   */
  static getEstimateRange(input: PricingInput): { min: number; max: number; average: number } {
    const breakdown = this.calculate(input);
    const min = Math.round(breakdown.total * 0.9 * 100) / 100;
    const max = Math.round(breakdown.total * 1.1 * 100) / 100;
    return { min, max, average: breakdown.total };
  }

  /**
   * Compare pricing with other platforms
   */
  static getComparisonPricing(total: number): {
    rena: number;
    typicalAgency: number;
    otherPlatforms: number;
    savings: number;
  } {
    const agencyMultiplier = 1.35; // Agencies charge 35% more on average
    const otherPlatformMultiplier = 1.2; // Other platforms charge 20% more

    return {
      rena: total,
      typicalAgency: Math.round(total * agencyMultiplier * 100) / 100,
      otherPlatforms: Math.round(total * otherPlatformMultiplier * 100) / 100,
      savings: Math.round(total * (agencyMultiplier - 1) * 100) / 100,
    };
  }
}
