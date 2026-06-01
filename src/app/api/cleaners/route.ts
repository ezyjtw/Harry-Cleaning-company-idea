import bcrypt from 'bcryptjs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import prisma from '@/lib/db/prisma';
import { AuditService } from '@/lib/services/audit.service';
import { haversineDistance, lookupPostcode } from '@/lib/utils/postcode';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const availableNow = searchParams.get('available_now');
  const postcode = searchParams.get('postcode');
  const specialty = searchParams.get('specialty');
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20));

  const now = new Date();
  const where: Record<string, unknown> = {
    verified: true,
    user: { accountStatus: 'ACTIVE', isDeleted: false },
    OR: [{ insuranceExpiresAt: null }, { insuranceExpiresAt: { gt: now } }],
  };

  if (availableNow === 'true') {
    where.availableNow = true;
  }

  if (specialty) {
    where.specialties = { has: specialty };
  }

  let customerGeo: { latitude: number; longitude: number } | null = null;

  if (postcode) {
    const geo = await lookupPostcode(postcode);
    if (geo) {
      customerGeo = { latitude: geo.latitude, longitude: geo.longitude };
      where.latitude = { not: null };
      where.longitude = { not: null };
    } else {
      const prefix = postcode.split(' ')[0].toUpperCase();
      where.postcode = { startsWith: prefix };
    }
  }

  const cleaners = await prisma.cleanerProfile.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          reviewsReceived: { select: { id: true } },
        },
      },
    },
    orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
  });

  let results = cleaners.map((c) => {
    let distance: number | null = null;
    if (customerGeo && c.latitude !== null && c.longitude !== null) {
      distance = haversineDistance(
        customerGeo.latitude,
        customerGeo.longitude,
        c.latitude,
        c.longitude
      );
    }
    return {
      id: c.user.id,
      name: c.user.name,
      photo: c.user.image || '',
      image: c.user.image,
      rating: Number(c.rating),
      reviewCount: c.user.reviewsReceived.length,
      completedJobs: c.completedJobs,
      hourlyRate: Number(c.hourlyRate),
      sameDayRate: Math.round(Number(c.hourlyRate) * 1.4 * 100) / 100,
      bio: c.bio,
      specialties: c.specialties,
      location: c.location || '',
      postcode: c.postcode,
      availableNow: c.availableNow,
      tier: c.tier.toLowerCase(),
      verified: c.verified,
      identityVerified: c.verificationStatus === 'VERIFIED',
      insured: c.insuranceVerified && (!c.insuranceExpiresAt || c.insuranceExpiresAt > now),
      backgroundChecked: c.backgroundCheckPassed,
      responseTime: c.responseTime ? `~${c.responseTime} min` : '~15 min',
      radius: c.radius,
      travelMode: c.travelMode,
      distance,
    };
  });

  if (customerGeo) {
    results = results.filter((r) => r.distance !== null && r.distance <= r.radius);
    results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  const total = results.length;
  const paged = results.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    cleaners: paged,
    count: total,
    page,
    pageCount: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const required = ['name', 'email', 'phone', 'postcode'];
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    if (body.yearsExperience !== undefined && Number(body.yearsExperience) > 50) {
      return NextResponse.json({ error: 'Years of experience cannot exceed 50' }, { status: 400 });
    }

    // Derive hourly rate — prioritise serviceRates (what the join form sends)
    let hourlyRate = 0;
    if (body.serviceRates && typeof body.serviceRates === 'object') {
      const allRates = Object.values(body.serviceRates)
        .map(Number)
        .filter((r: number) => r > 0);
      if (allRates.length > 0) hourlyRate = allRates[0];
    }
    if (!hourlyRate) hourlyRate = Number(body.hourlyRate) || 0;
    if (!hourlyRate || hourlyRate < 14) hourlyRate = 15;

    const geo = await lookupPostcode(body.postcode.trim());

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: body.email.toLowerCase().trim() },
      include: { cleanerProfile: { select: { id: true } } },
    });

    if (existing) {
      // Already a cleaner — block duplicate
      if (existing.cleanerProfile || existing.role === 'CLEANER') {
        return NextResponse.json(
          { error: 'A cleaner account with this email already exists. Please log in instead.' },
          { status: 409 }
        );
      }

      // Existing client — upgrade to cleaner
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id: existing.id },
          data: {
            role: 'CLEANER',
            phone: body.phone?.trim() || existing.phone,
            passwordHash: body.password
              ? await bcrypt.hash(body.password, 12)
              : existing.passwordHash,
            image: body.profilePhoto || existing.image,
          },
        });

        const profile = await tx.cleanerProfile.create({
          data: {
            userId: user.id,
            bio: body.bio?.trim() || null,
            hourlyRate,
            specialties: body.specialties || [],
            languages: body.languages || [],
            serviceTypes: body.serviceTypes || [],
            serviceRates: body.serviceRates || undefined,
            hoursPerWeek: body.hoursPerWeek ? Number(body.hoursPerWeek) : null,
            yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : null,
            location: body.postcode?.trim() || null,
            postcode: body.postcode?.trim() || null,
            latitude: geo?.latitude ?? null,
            longitude: geo?.longitude ?? null,
            radius: 10,
            travelMode: body.travelMode || 'public_transport',
            verificationStatus: 'PENDING',
            rightToWorkDocType: body.rightToWorkDocType || null,
            rightToWorkShareCode: body.rightToWorkShareCode || null,
            rightToWorkExpiresAt: body.rightToWorkExpiryDate
              ? new Date(body.rightToWorkExpiryDate)
              : null,
            dbsCertNumber: body.dbsCertNumber?.trim() || null,
            dbsCertIssueDate: body.dbsCertIssueDate ? new Date(body.dbsCertIssueDate) : null,
            rightToWorkStatus: body.rightToWorkDocType ? 'PENDING' : 'UNVERIFIED',
            verificationMeta: body.selfiePhoto
              ? { livenessComplete: true, dbsOption: body.dbsOption || null }
              : body.dbsOption
                ? { dbsOption: body.dbsOption }
                : undefined,
          },
        });

        return { user, profile };
      });

      await AuditService.log({
        userId: result.user.id,
        action: 'USER_REGISTERED',
        entityType: 'User',
        entityId: result.user.id,
        metadata: { role: 'CLEANER', email: body.email, upgradedFromClient: true },
      });

      await AuditService.log({
        userId: result.user.id,
        action: 'CLEANER_PROFILE_UPDATED',
        entityType: 'CleanerProfile',
        entityId: result.profile.id,
        metadata: {
          event: 'onboarding_submitted',
          dbsOption: body.dbsOption || null,
          hasRtwDoc: !!body.rightToWorkDocType,
          hasSelfie: !!body.selfiePhoto,
        },
      });

      return NextResponse.json(
        {
          message: 'Account upgraded to cleaner successfully',
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

    // Create User + CleanerProfile in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email.toLowerCase().trim(),
          name: body.name.trim(),
          phone: body.phone.trim(),
          role: 'CLEANER',
          passwordHash: body.password ? await bcrypt.hash(body.password, 12) : null,
          image: body.profilePhoto || null,
        },
      });

      const profile = await tx.cleanerProfile.create({
        data: {
          userId: user.id,
          bio: body.bio?.trim() || null,
          hourlyRate: hourlyRate,
          specialties: body.specialties || [],
          languages: body.languages || [],
          serviceTypes: body.serviceTypes || [],
          serviceRates: body.serviceRates || undefined,
          hoursPerWeek: body.hoursPerWeek ? Number(body.hoursPerWeek) : null,
          yearsExperience: body.yearsExperience ? Number(body.yearsExperience) : null,
          location: body.postcode?.trim() || null,
          postcode: body.postcode?.trim() || null,
          latitude: geo?.latitude ?? null,
          longitude: geo?.longitude ?? null,
          radius: 10,
          travelMode: body.travelMode || 'public_transport',
          verificationStatus: 'PENDING',
          rightToWorkDocType: body.rightToWorkDocType || null,
          rightToWorkShareCode: body.rightToWorkShareCode || null,
          rightToWorkExpiresAt: body.rightToWorkExpiryDate
            ? new Date(body.rightToWorkExpiryDate)
            : null,
          dbsCertNumber: body.dbsCertNumber?.trim() || null,
          dbsCertIssueDate: body.dbsCertIssueDate ? new Date(body.dbsCertIssueDate) : null,
          rightToWorkStatus: body.rightToWorkDocType ? 'PENDING' : 'UNVERIFIED',
          verificationMeta: body.selfiePhoto
            ? { livenessComplete: true, dbsOption: body.dbsOption || null }
            : body.dbsOption
              ? { dbsOption: body.dbsOption }
              : undefined,
        },
      });

      return { user, profile };
    });

    await AuditService.log({
      userId: result.user.id,
      action: 'USER_REGISTERED',
      entityType: 'User',
      entityId: result.user.id,
      metadata: { role: 'CLEANER', email: body.email },
    });

    await AuditService.log({
      userId: result.user.id,
      action: 'CLEANER_PROFILE_UPDATED',
      entityType: 'CleanerProfile',
      entityId: result.profile.id,
      metadata: {
        event: 'onboarding_submitted',
        dbsOption: body.dbsOption || null,
        hasRtwDoc: !!body.rightToWorkDocType,
        hasSelfie: !!body.selfiePhoto,
      },
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
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Cleaners] POST error:', error);
    return NextResponse.json(
      { error: 'Something went wrong processing your application. Please try again.' },
      { status: 500 }
    );
  }
}
