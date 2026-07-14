import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';

import CleanerDetailClient from './CleanerDetailClient';

export const dynamic = 'force-dynamic';

export interface CleanerDocument {
  id: string;
  documentType: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  isVerified: boolean;
  verifiedAt: string | null;
  createdAt: string;
  rejectedAt: string | null;
  rejectionReason: string | null;
}

export interface CleanerDetail {
  userId: string;
  profileId: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  image: string | null;
  bio: string | null;
  hourlyRateRegular: number | null;
  hourlyRateDeep: number | null;
  hourlyRateSameDay: number | null;
  specialties: string[];
  languages: string[];
  serviceTypes: string[];
  postcode: string | null;
  location: string | null;
  radius: number;
  travelMode: string | null;
  tier: string;
  verified: boolean;
  verificationStatus: string;
  verificationMeta: Record<string, unknown> | null;
  completedJobs: number;
  rating: number;
  yearsExperience: number | null;
  hoursPerWeek: number | null;
  backgroundCheckPassed: boolean;
  dbsCertNumber: string | null;
  dbsCertVerified: boolean;
  identityVerifiedAt: string | null;
  insuranceVerified: boolean;
  insuranceExpiresAt: string | null;
  rightToWorkStatus: string | null;
  rightToWorkDocType: string | null;
  rightToWorkExpiresAt: string | null;
  documents: CleanerDocument[];
}

async function getCleanerDetail(userId: string): Promise<CleanerDetail | null> {
  const profile = await prisma.cleanerProfile.findFirst({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          image: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) return null;

  const documents = await prisma.documentUpload.findMany({
    where: { profileId: profile.id, isDestroyed: false },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      documentType: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      isVerified: true,
      verifiedAt: true,
      createdAt: true,
      // F7: rejection is part of the row's story, not just the audit log.
      rejectedAt: true,
      rejectionReason: true,
    },
  });

  return {
    userId: profile.user.id,
    profileId: profile.id,
    name: displayName(profile.user.name) || 'Unknown',
    email: profile.user.email,
    phone: profile.user.phone,
    createdAt: profile.user.createdAt.toISOString(),
    image: await resolveProfileImageUrl(profile.user.image),
    bio: profile.bio,
    hourlyRateRegular: profile.hourlyRateRegular ? Number(profile.hourlyRateRegular) : null,
    hourlyRateDeep: profile.hourlyRateDeep ? Number(profile.hourlyRateDeep) : null,
    hourlyRateSameDay: profile.hourlyRateSameDay ? Number(profile.hourlyRateSameDay) : null,
    specialties: profile.specialties,
    languages: profile.languages || [],
    serviceTypes: profile.serviceTypes || [],
    postcode: profile.postcode,
    location: profile.location,
    radius: profile.radius,
    travelMode: profile.travelMode,
    tier: profile.tier,
    verified: profile.verified,
    verificationStatus: profile.verificationStatus,
    verificationMeta: (profile.verificationMeta as Record<string, unknown>) || null,
    completedJobs: profile.completedJobs,
    rating: Number(profile.rating),
    yearsExperience: profile.yearsExperience,
    hoursPerWeek: profile.hoursPerWeek,
    backgroundCheckPassed: profile.backgroundCheckPassed,
    dbsCertNumber: profile.dbsCertNumber,
    dbsCertVerified: profile.dbsCertVerified,
    identityVerifiedAt: profile.identityVerifiedAt?.toISOString() || null,
    insuranceVerified: profile.insuranceVerified,
    insuranceExpiresAt: profile.insuranceExpiresAt?.toISOString() || null,
    rightToWorkStatus: profile.rightToWorkStatus,
    rightToWorkDocType: profile.rightToWorkDocType,
    rightToWorkExpiresAt: profile.rightToWorkExpiresAt?.toISOString() || null,
    documents: documents.map((d) => ({
      id: d.id,
      documentType: d.documentType,
      originalName: d.originalName,
      fileSize: d.fileSize,
      mimeType: d.mimeType,
      isVerified: d.isVerified,
      verifiedAt: d.verifiedAt?.toISOString() || null,
      createdAt: d.createdAt.toISOString(),
      rejectedAt: d.rejectedAt?.toISOString() || null,
      rejectionReason: d.rejectionReason,
    })),
  };
}

export default async function AdminCleanerDetailPage({ params }: { params: { id: string } }) {
  const cleaner = await getCleanerDetail(params.id);
  if (!cleaner) notFound();
  return <CleanerDetailClient cleaner={cleaner} />;
}
