import { notFound } from 'next/navigation';

import { prisma } from '@/lib/db/prisma';
import { SWEEP_AGE_DAYS } from '@/lib/services/incomplete-signup.service';
import { resolveProfileImageUrl } from '@/lib/storage/r2-client';
import { displayName } from '@/lib/utils/name';

import CleanerDetailClient from './CleanerDetailClient';
import IncompleteSignupClient from './IncompleteSignupClient';

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
  emailVerified: string | null;
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
  // H107: `radius` is deliberately NOT surfaced — it's a schema default (10)
  // nobody collects and live matching never consults (eligibility requires
  // maxTravelMinutes, so the radius fallback branch is unreachable for any
  // matchable cleaner). travelMode is shown but labelled honestly: the ORS
  // isochrone hardcodes driving-car and the crow-flies fallback is flat 25mph.
  travelMode: string | null;
  // H107: the LIVE matching model — polygon truth + maxTravelMinutes.
  homePostcode: string | null;
  maxTravelMinutes: number | null;
  hasGeo: boolean;
  hasCatchmentPolygon: boolean;
  catchmentGeneratedAt: string | null;
  catchmentSource: string | null;
  tier: string;
  verified: boolean;
  foundingCleaner: boolean;
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
          emailVerified: true,
          phone: true,
          image: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) return null;

  // catchmentPolygon is globally omitted (large GeoJSON blob) — the dossier
  // only needs PRESENCE, so ask the DB for the boolean, never the blob.
  const [polygonRow] = await prisma.$queryRaw<{ present: boolean }[]>`
    SELECT "catchmentPolygon" IS NOT NULL AS present
    FROM "CleanerProfile" WHERE id = ${profile.id}`;

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
    emailVerified: profile.user.emailVerified ? profile.user.emailVerified.toISOString() : null,
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
    travelMode: profile.travelMode,
    homePostcode: profile.homePostcode,
    maxTravelMinutes: profile.maxTravelMinutes,
    hasGeo:
      (profile.homeLatitude !== null && profile.homeLongitude !== null) ||
      (profile.latitude !== null && profile.longitude !== null),
    hasCatchmentPolygon: polygonRow?.present ?? false,
    catchmentGeneratedAt: profile.catchmentGeneratedAt?.toISOString() || null,
    catchmentSource: profile.catchmentSource,
    tier: profile.tier,
    verified: profile.verified,
    foundingCleaner: profile.foundingCleaner,
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

// ─── F28: incomplete-signup dossier ─────────────────────────────────────────
// The list links EVERY row here, but a signup-incomplete row is BY DEFINITION
// a CLEANER user with no CleanerProfile — so the profile-keyed dossier above
// 404'd for exactly the rows an admin most needs to chase. This branch renders
// what the database actually holds for a step-0 account.

export interface FunnelStepRow {
  /** Wizard step index (0-6) the user ENTERED, per the /join funnel mapping. */
  stepIndex: number;
  stepName: string;
  firstAt: string;
}

export interface IncompleteSignupDetail {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string; // account creation = wizard step 0 completed
  accountStatus: string;
  isSuspended: boolean;
  emailVerified: string | null;
  /** Latest verification token's expiry — is the link in their inbox live? */
  verifyTokenExpires: string | null;
  /** When the LB-3 30-day sweep will remove this account. */
  sweepAt: string;
  funnel: {
    /** cleaner_signup analytics sessions time-matched to this account. */
    matchedSessions: number;
    /** Furthest wizard step (0-6) the matched trail shows them REACHING. */
    furthestStepIndex: number | null;
    lastActivityAt: string | null;
    steps: FunnelStepRow[];
  };
}

async function getIncompleteSignupDetail(userId: string): Promise<IncompleteSignupDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      accountStatus: true,
      isSuspended: true,
      isDeleted: true,
      emailVerified: true,
      cleanerProfile: { select: { id: true } },
    },
  });
  // Same structural definition as the list chip and the H106 broom guard.
  if (!user || user.isDeleted || user.role !== 'CLEANER' || user.cleanerProfile) return null;

  const latestToken = await prisma.verificationToken.findFirst({
    where: { identifier: user.email },
    orderBy: { expires: 'desc' },
    select: { expires: true },
  });

  // Wizard progress beyond step 0 lives ONLY in AnalyticsEvent (anonymous
  // sessionId, no userId — the hook never sends one). Correlation anchor: the
  // step-0→step-1 transition fires trackStep(funnelStep 3) seconds after
  // signup-start creates the account, so sessions whose first funnelStep>=3
  // event lands within 5 minutes of account creation are this person's trail.
  // Best-effort by construction — matchedSessions tells the admin how firm it is.
  let funnel: IncompleteSignupDetail['funnel'] = {
    matchedSessions: 0,
    furthestStepIndex: null,
    lastActivityAt: null,
    steps: [],
  };
  try {
    const anchorEvents = await prisma.analyticsEvent.findMany({
      where: {
        funnel: 'cleaner_signup',
        eventType: 'FUNNEL_STEP',
        funnelStep: { gte: 3 },
        createdAt: { gte: user.createdAt, lte: new Date(user.createdAt.getTime() + 5 * 60_000) },
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    });
    const sessionIds = anchorEvents.map((e) => e.sessionId);
    if (sessionIds.length > 0) {
      const events = await prisma.analyticsEvent.findMany({
        where: {
          sessionId: { in: sessionIds },
          funnel: 'cleaner_signup',
          eventType: 'FUNNEL_STEP',
          funnelStep: { gte: 3 },
        },
        select: { funnelStep: true, stepName: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });
      const firstByStep = new Map<number, { stepName: string; firstAt: Date }>();
      let lastAt: Date | null = null;
      for (const ev of events) {
        if (ev.funnelStep === null) continue;
        // /join mapping: entering wizard step S (1-6) fires funnelStep S+2.
        const stepIndex = ev.funnelStep - 2;
        if (stepIndex < 1 || stepIndex > 6) continue;
        if (!firstByStep.has(stepIndex)) {
          firstByStep.set(stepIndex, {
            stepName: ev.stepName || `step_${stepIndex}`,
            firstAt: ev.createdAt,
          });
        }
        if (!lastAt || ev.createdAt > lastAt) lastAt = ev.createdAt;
      }
      const steps = Array.from(firstByStep.entries())
        .map(([stepIndex, v]) => ({
          stepIndex,
          stepName: v.stepName,
          firstAt: v.firstAt.toISOString(),
        }))
        .sort((a, b) => a.stepIndex - b.stepIndex);
      funnel = {
        matchedSessions: sessionIds.length,
        furthestStepIndex: steps.length > 0 ? steps[steps.length - 1].stepIndex : null,
        lastActivityAt: lastAt ? lastAt.toISOString() : null,
        steps,
      };
    }
  } catch {
    // The dossier's identity facts must render even if the analytics
    // correlation fails — progress simply shows as unknown.
  }

  return {
    userId: user.id,
    name: displayName(user.name) || 'Unknown',
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    accountStatus: user.accountStatus,
    isSuspended: user.isSuspended,
    emailVerified: user.emailVerified ? user.emailVerified.toISOString() : null,
    verifyTokenExpires: latestToken ? latestToken.expires.toISOString() : null,
    sweepAt: new Date(
      user.createdAt.getTime() + SWEEP_AGE_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
    funnel,
  };
}

export default async function AdminCleanerDetailPage({ params }: { params: { id: string } }) {
  const cleaner = await getCleanerDetail(params.id);
  if (cleaner) return <CleanerDetailClient cleaner={cleaner} />;
  const incomplete = await getIncompleteSignupDetail(params.id);
  if (incomplete) return <IncompleteSignupClient signup={incomplete} />;
  notFound();
}
