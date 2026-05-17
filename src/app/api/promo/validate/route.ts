import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Promo code is required' }, { status: 400 });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!promo || !promo.isActive) {
      return NextResponse.json({ error: 'Invalid promo code' }, { status: 404 });
    }

    const now = new Date();
    if (promo.validUntil && promo.validUntil < now) {
      return NextResponse.json({ error: 'This promo code has expired' }, { status: 410 });
    }

    if (promo.validFrom > now) {
      return NextResponse.json({ error: 'This promo code is not yet active' }, { status: 400 });
    }

    if (promo.maxUses && promo.usedCount >= promo.maxUses) {
      return NextResponse.json(
        { error: 'This promo code has been fully redeemed' },
        { status: 410 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: promo.code,
      discountPercent: promo.discountPercent,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Promo] validate error:', error);
    return NextResponse.json({ error: 'Failed to validate promo code' }, { status: 500 });
  }
}
