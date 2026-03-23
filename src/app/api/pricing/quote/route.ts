import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { pricingService } from '@/lib/services/pricing.service';

const schema = z.object({
  serviceSlug: z.enum(['regular', 'one-off', 'same-day', 'deep', 'eot', 'airbnb']),
  cleanerHourlyRate: z.number().min(14).max(35),
  hours: z.number().min(2).max(12).optional(),
  propertySize: z
    .enum(['STUDIO', 'ONE_BED', 'TWO_BED', 'THREE_BED', 'FOUR_BED', 'FIVE_PLUS'])
    .optional(),
  frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'ONE_OFF']).optional(),
  addons: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = schema.parse(body);
    const quote = await pricingService.calculateQuote(input);
    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to calculate quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
