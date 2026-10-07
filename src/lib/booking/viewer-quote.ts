// B3.3 (RENA-026): the viewer's own figure for a job offered to them as a
// backup, reserve or broadcast recipient — their quote at THEIR rates (moved
// from the jobs list route so the detail route shows the same figure).

import type { Booking } from '@prisma/client';

import { normalizeToPricingSlug, propertySizeEnumToSlug } from '@/lib/constants/services';
import { cleanerEarningsBreakdown, pricingService } from '@/lib/services/pricing.service';
import type { ServiceSlug } from '@/lib/services/pricing.service';

export async function viewerQuote(
  b: Pick<Booking, 'serviceType' | 'propertySize' | 'duration' | 'extras'>,
  viewerId: string
): Promise<{
  viewerEarnings: number | null;
  viewerBreakdown: ReturnType<typeof cleanerEarningsBreakdown>;
}> {
  try {
    const pricingSlug = normalizeToPricingSlug(b.serviceType);
    const propertySize = b.propertySize
      ? propertySizeEnumToSlug(b.propertySize as Parameters<typeof propertySizeEnumToSlug>[0])
      : undefined;
    const quote = await pricingService.calculateQuote({
      cleanerId: viewerId,
      serviceSlug: pricingSlug as ServiceSlug,
      hours: Number(b.duration),
      propertySize,
      addons: b.extras,
    });
    return {
      viewerEarnings: quote.cleanerPayout,
      viewerBreakdown: cleanerEarningsBreakdown({
        serviceType: b.serviceType,
        customerSubtotal: quote.cleanerListedPrice,
        cleanerEarnings: quote.cleanerPayout,
        extras: b.extras,
      }),
    };
  } catch {
    // If quoting fails, fall back to stored values — better than hiding the job
    return { viewerEarnings: null, viewerBreakdown: null };
  }
}
