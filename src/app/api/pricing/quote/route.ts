import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { rateLimit } from '@/lib/rate-limit';
import { pricingService } from '@/lib/services/pricing.service';

const SERVICE_SLUGS = ['regular', 'same-day', 'deep', 'eot', 'airbnb'] as const;

const cleanerQuoteSchema = z.object({
  cleanerId: z.string().min(1),
  serviceSlug: z.enum(SERVICE_SLUGS),
  hours: z.number().min(2).max(12).optional(),
  propertySize: z.string().optional(),
  addons: z.array(z.string()).optional(),
});

const areaQuoteSchema = z.object({
  postcode: z.string().min(2),
  serviceSlug: z.enum(SERVICE_SLUGS),
  hours: z.number().min(2).max(12).optional(),
  propertySize: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rl = rateLimit(req, 'pricing-quote', 120, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } }
      );
    }

    const body = await req.json();

    if (body.cleanerId) {
      const input = cleanerQuoteSchema.parse(body);
      const quote = await pricingService.calculateQuote(input);
      return NextResponse.json({ mode: 'cleaner', ...quote });
    }

    if (body.postcode) {
      const input = areaQuoteSchema.parse(body);
      const result = await pricingService.calculateAreaQuote(input);
      return NextResponse.json({ mode: 'area', ...result });
    }

    return NextResponse.json(
      { error: 'Either cleanerId or postcode is required.' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Failed to calculate quote';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
