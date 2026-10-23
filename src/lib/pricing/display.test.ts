import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { pricingService } from '@/lib/services/pricing.service';

import { advertisedPrice } from './display';
import { PLATFORM_FEE_RATE } from './rates';

// The fee ruling: a pre-checkout surface shows the cleaner's own price; the
// checkout total is that price plus the 6% service fee. The directory card
// (src/components/CleanerCard.tsx) is the surface that used to fold the fee in.
const prisma = vi.hoisted(() => ({
  cleanerProfile: { findFirst: vi.fn() },
  serviceType: { findUnique: vi.fn() },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma, default: prisma }));


const ROOT = join(__dirname, '..', '..', '..');

describe('display price versus checkout total', () => {
  it('the directory card shows the cleaner price; checkout adds the 6% fee', async () => {
    prisma.cleanerProfile.findFirst.mockResolvedValue({
      hourlyRateRegular: null,
      hourlyRateDeep: null,
      hourlyRateSameDay: null,
      eotPrices: { TWO_BED: 280 },
      airbnbPrices: null,
      serviceTypes: ['end_of_tenancy'],
    });
    prisma.serviceType.findUnique.mockResolvedValue({ name: 'End of Tenancy', addons: [] });
    const quote = await pricingService.calculateQuote({
      cleanerId: 'c1',
      serviceSlug: 'eot',
      propertySize: 'TWO_BED',
    } as never);
    expect(advertisedPrice(280)).toBe('280.00');
    expect(quote.cleanerListedPrice).toBe(280);
    expect(quote.customerPlatformFee).toBe(280 * PLATFORM_FEE_RATE);
    expect(quote.customerTotal).toBe(296.8);
    expect(advertisedPrice(280)).not.toBe(quote.customerTotal.toFixed(2));
  });

  it('the directory card source carries no fee multiplication or fee label', () => {
    const card = readFileSync(join(ROOT, 'src/components/CleanerCard.tsx'), 'utf8');
    expect(card).toContain('advertisedPrice(');
    expect(card).not.toMatch(
      /1\.06|PLATFORM_FEE_RATE|SERVICE_FEE_PERCENT|incl\. fee|all-inclusive/
    );
  });
});
