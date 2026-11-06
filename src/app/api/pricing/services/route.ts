import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

// B6 (D-ad): only what the callers read, so no dead price is served. The
// service page reads fixedPrices[].estimatedHours (the LB-6 calendar hold) and
// the homepage quote widget reads addons; both find their row by slug.
export async function GET() {
  try {
    const services = await prisma.serviceType.findMany({
      where: { isActive: true },
      select: {
        slug: true,
        fixedPrices: { select: { propertySize: true, estimatedHours: true } },
        addons: { where: { isActive: true }, select: { id: true, name: true, price: true } },
      },
      orderBy: { slug: 'asc' },
    });

    return NextResponse.json(services);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
  }
}
