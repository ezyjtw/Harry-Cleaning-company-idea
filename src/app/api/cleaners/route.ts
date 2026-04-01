import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const availableNow = searchParams.get('available_now');
  const postcode = searchParams.get('postcode');
  const specialty = searchParams.get('specialty');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const where: Record<string, unknown> = {
    verified: true,
    user: { accountStatus: 'ACTIVE', isDeleted: false },
  };

  if (availableNow === 'true') {
    where.availableNow = true;
  }

  if (postcode) {
    // Partial postcode prefix match for area filtering
    const prefix = postcode.split(' ')[0].toUpperCase();
    where.postcode = { startsWith: prefix };
  }

  if (specialty) {
    where.specialties = { has: specialty };
  }

  const [cleaners, total] = await Promise.all([
    prisma.cleanerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.cleanerProfile.count({ where }),
  ]);

  return NextResponse.json({
    cleaners: cleaners.map((c) => ({
      id: c.user.id,
      name: c.user.name,
      image: c.user.image,
      rating: Number(c.rating),
      completedJobs: c.completedJobs,
      hourlyRate: Number(c.hourlyRate),
      bio: c.bio,
      specialties: c.specialties,
      location: c.location,
      postcode: c.postcode,
      availableNow: c.availableNow,
      tier: c.tier,
      verified: c.verified,
      radius: c.radius,
    })),
    count: total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Validate required fields
  const required = ['name', 'email', 'phone', 'postcode'];
  for (const field of required) {
    if (!body[field]?.trim()) {
      return NextResponse.json({ error: `${field} is required` }, { status: 400 });
    }
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'An account with this email already exists' },
      { status: 409 }
    );
  }

  // Validate hourly rate
  const hourlyRate = Number(body.hourlyRate) || 15;
  if (hourlyRate < 14 || hourlyRate > 35) {
    return NextResponse.json({ error: 'Hourly rate must be between £14 and £35' }, { status: 400 });
  }

  // Create User + CleanerProfile in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        name: body.name.trim(),
        phone: body.phone.trim(),
        role: 'CLEANER',
        // TODO: Hash password with bcrypt when signup includes password creation
        passwordHash: body.password || null,
        image: body.profilePhoto || null,
      },
    });

    const profile = await tx.cleanerProfile.create({
      data: {
        userId: user.id,
        bio: body.bio?.trim() || null,
        hourlyRate: hourlyRate,
        specialties: body.specialties || [],
        location: body.postcode?.trim() || null,
        postcode: body.postcode?.trim() || null,
        radius: 10,
        verificationStatus: 'PENDING',
        rightToWorkDocType: body.rightToWorkDocType || null,
        rightToWorkShareCode: body.rightToWorkShareCode || null,
        rightToWorkExpiresAt: body.rightToWorkExpiryDate
          ? new Date(body.rightToWorkExpiryDate)
          : null,
      },
    });

    return { user, profile };
  });

  return NextResponse.json(
    {
      message: 'Application submitted successfully',
      cleaner: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        status: 'pending_review',
        verificationStatus: result.profile.verificationStatus,
      },
    },
    { status: 201 }
  );
}
