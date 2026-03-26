import Decimal from 'decimal.js';

import { prisma } from '@/lib/db/prisma';

// ─── Types ──────────────────────────────────────────────────────

export type ServiceSlug = 'regular' | 'one-off' | 'same-day' | 'deep' | 'eot' | 'airbnb';

export interface QuoteInput {
  serviceSlug: ServiceSlug;
  cleanerHourlyRate: number; // cleaner's advertised standard rate
  hours?: number; // required for hourly services
  propertySize?: string; // required for EOT and Airbnb
  frequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'ONE_OFF';
  addons?: string[]; // addon IDs
}

export interface QuoteResult {
  serviceType: string;
  cleanerHourlyRate: number;
  cleanerDeepRate: number | null; // derived for EOT/Airbnb
  hours: number | null;
  propertySize: string | null;
  isFixedPrice: boolean;

  // Cleaner side
  cleanerGross: number; // what cleaner earns before Rena's 10% cut
  cleanerFee: number; // 10% deducted — Rena's cut from cleaner
  cleanerEarns: number; // net payout to cleaner

  // Customer side
  customerSubtotal: number; // base price before 6% service fee
  customerServiceFee: number; // 6% on top (hourly) or embedded (fixed)
  addonTotal: number;
  totalCharged: number; // customer pays this

  // Rena
  renaEarns: number; // total Rena revenue on this booking
  breakdown: string;
}

// ─── Service ────────────────────────────────────────────────────

export class PricingService {
  private async getConfig(): Promise<Record<string, number>> {
    const configs = await prisma.platformConfig.findMany();
    return Object.fromEntries(configs.map((c) => [c.key, parseFloat(c.value)]));
  }

  async calculateQuote(input: QuoteInput): Promise<QuoteResult> {
    const config = await this.getConfig();
    const cleanerFeePct = config['cleaner_fee_pct']; // 0.10
    const customerFeePct = config['customer_fee_pct']; // 0.06
    const deepMultiplier = config['deep_multiplier']; // 1.45

    const serviceType = await prisma.serviceType.findUnique({
      where: { slug: input.serviceSlug },
      include: { fixedPrices: true, addons: true },
    });

    if (!serviceType) throw new Error(`Unknown service: ${input.serviceSlug}`);

    // ── Fixed-price services (EOT, Airbnb) ───────────────────────
    if (serviceType.pricingModel === 'FIXED') {
      if (!input.propertySize) {
        throw new Error('propertySize required for fixed-price services');
      }

      const fixedPrice = serviceType.fixedPrices.find(
        (fp) => fp.propertySize === input.propertySize
      );
      if (!fixedPrice) throw new Error(`No price found for ${input.propertySize}`);

      // Use deep rate for cleaner payout on intensive fixed-price jobs
      const cleanerDeepRate = new Decimal(input.cleanerHourlyRate)
        .mul(deepMultiplier)
        .toDecimalPlaces(2)
        .toNumber();

      // EOT cleaners get an additional 10% bonus on top of deep rate × hours
      const isEot = input.serviceSlug === 'eot';
      const eotBonusMultiplier = isEot ? 1.1 : 1.0;

      const cleanerGross = new Decimal(cleanerDeepRate)
        .mul(fixedPrice.estimatedHours)
        .mul(eotBonusMultiplier)
        .toDecimalPlaces(2)
        .toNumber();

      const cleanerFee = new Decimal(cleanerGross).mul(cleanerFeePct).toDecimalPlaces(2).toNumber();

      const cleanerEarns = new Decimal(cleanerGross)
        .minus(cleanerFee)
        .toDecimalPlaces(2)
        .toNumber();

      const addonTotal = this.calcAddonTotal(input.addons ?? [], serviceType.addons);
      const totalCharged = new Decimal(fixedPrice.customerPrice)
        .plus(addonTotal)
        .toDecimalPlaces(2)
        .toNumber();
      // Customer fee is embedded in fixed price — not added on top
      const customerServiceFee = 0;

      const renaEarns = new Decimal(totalCharged)
        .minus(cleanerEarns)
        .minus(this.calcCleanerAddonEarnings(input.addons ?? [], serviceType.addons))
        .toDecimalPlaces(2)
        .toNumber();

      return {
        serviceType: serviceType.name,
        cleanerHourlyRate: input.cleanerHourlyRate,
        cleanerDeepRate,
        hours: fixedPrice.estimatedHours,
        propertySize: input.propertySize,
        isFixedPrice: true,
        cleanerGross,
        cleanerFee,
        cleanerEarns,
        customerSubtotal: fixedPrice.customerPrice,
        customerServiceFee,
        addonTotal,
        totalCharged,
        renaEarns,
        breakdown: `Fixed price £${fixedPrice.customerPrice}. Cleaner paid at deep rate £${cleanerDeepRate}/hr × ${fixedPrice.estimatedHours} hrs${isEot ? ' × 1.10 EOT bonus' : ''} = £${cleanerGross} gross, earns £${cleanerEarns} after 10% Rena fee. Rena keeps £${renaEarns}.`,
      };
    }

    // ── Hourly services ───────────────────────────────────────────
    if (!input.hours) throw new Error('hours required for hourly services');

    const minHours = serviceType.minimumHours ?? 2;
    const hours = Math.max(input.hours, minHours);

    let multiplier = serviceType.baseMultiplier;
    if (input.serviceSlug === 'regular' && input.frequency === 'FORTNIGHTLY') {
      multiplier = new Decimal(multiplier).mul(config['fortnightly_multiplier']).toNumber();
    }

    const cleanerGross = new Decimal(input.cleanerHourlyRate)
      .mul(hours)
      .mul(multiplier)
      .toDecimalPlaces(2)
      .toNumber();

    const cleanerFee = new Decimal(cleanerGross).mul(cleanerFeePct).toDecimalPlaces(2).toNumber();

    const cleanerEarns = new Decimal(cleanerGross).minus(cleanerFee).toDecimalPlaces(2).toNumber();

    // Customer sees the listed rate (cleaner gross + 10% platform markup baked in)
    const customerSubtotal = new Decimal(cleanerGross)
      .plus(cleanerFee)
      .toDecimalPlaces(2)
      .toNumber();

    // 6% service fee is charged on the listed rate, not the raw cleaner rate
    const customerServiceFee = new Decimal(customerSubtotal)
      .mul(customerFeePct)
      .toDecimalPlaces(2)
      .toNumber();

    const addonTotal = this.calcAddonTotal(input.addons ?? [], serviceType.addons);

    const totalCharged = new Decimal(customerSubtotal)
      .plus(customerServiceFee)
      .plus(addonTotal)
      .toDecimalPlaces(2)
      .toNumber();

    const renaEarns = new Decimal(cleanerFee)
      .plus(customerServiceFee)
      .toDecimalPlaces(2)
      .toNumber();

    return {
      serviceType: serviceType.name,
      cleanerHourlyRate: input.cleanerHourlyRate,
      cleanerDeepRate: null,
      hours,
      propertySize: null,
      isFixedPrice: false,
      cleanerGross,
      cleanerFee,
      cleanerEarns,
      customerSubtotal,
      customerServiceFee,
      addonTotal,
      totalCharged,
      renaEarns,
      breakdown: `${hours} hrs × £${input.cleanerHourlyRate}/hr × ${multiplier}x = £${cleanerGross}. Listed rate (incl. 10% markup): £${customerSubtotal}. Customer pays £${customerServiceFee} service fee (6%). Cleaner pays £${cleanerFee} platform fee (10%). Rena earns £${renaEarns}.`,
    };
  }

  private calcAddonTotal(addonIds: string[], available: { id: string; price: number }[]): number {
    if (!addonIds.length) return 0;
    const matched = available.filter((a) => addonIds.includes(a.id));
    return matched.reduce((sum, a) => sum + a.price, 0);
  }

  /**
   * For fixed-price services, cleaner earns 86% of each add-on.
   */
  private calcCleanerAddonEarnings(
    addonIds: string[],
    available: { id: string; price: number }[]
  ): number {
    if (!addonIds.length) return 0;
    const matched = available.filter((a) => addonIds.includes(a.id));
    return matched.reduce(
      (sum, a) => new Decimal(sum).plus(new Decimal(a.price).mul(0.85)).toNumber(),
      0
    );
  }

  /**
   * Validate a cleaner's proposed hourly rate against platform min/max.
   */
  async validateCleanerRate(rate: number): Promise<{ valid: boolean; message?: string }> {
    const config = await this.getConfig();
    const min = config['min_cleaner_rate'];
    const max = config['max_cleaner_rate'];
    if (rate < min) return { valid: false, message: `Minimum rate is £${min}/hr` };
    if (rate > max) return { valid: false, message: `Maximum rate is £${max}/hr` };
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
