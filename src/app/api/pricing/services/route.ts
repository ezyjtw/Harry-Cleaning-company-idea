import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const services = await prisma.serviceType.findMany({
      where: { isActive: true },
      include: {
        fixedPrices: true,
        addons: { where: { isActive: true } },
      },
      orderBy: { slug: 'asc' },
    });

    return NextResponse.json(services);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}
