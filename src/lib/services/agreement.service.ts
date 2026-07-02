import { createHash } from 'crypto';

import { prisma } from '@/lib/db/prisma';
import {
  CURRENT_AGREEMENT,
  CURRENT_AGREEMENT_VERSION,
} from '@/lib/legal/self-employment-acknowledgment';

import { AuditService } from './audit.service';

/** SHA-256 hex of a document body — the fingerprint stored on each acceptance. */
export function hashAgreementText(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/** Hash of the CURRENT acknowledgment body. */
export function currentAgreementHash(): string {
  return hashAgreementText(CURRENT_AGREEMENT.body);
}

// A14: capture + report the cleaner's self-employment acknowledgment.
// AgreementAcceptance is the append-only evidence log; CleanerProfile
// .acknowledgmentVersion is the denormalized current state the gates read.

export interface AcknowledgmentStatus {
  currentVersion: string;
  acknowledgedVersion: string | null;
  acknowledged: boolean; // true only when the CURRENT version is acknowledged
}

/** Has this cleaner acknowledged the CURRENT version? (gate helper) */
export async function hasAcknowledgedCurrent(cleanerId: string): Promise<boolean> {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerId },
    select: { acknowledgmentVersion: true },
  });
  return profile?.acknowledgmentVersion === CURRENT_AGREEMENT_VERSION;
}

export async function getAcknowledgmentStatus(cleanerId: string): Promise<AcknowledgmentStatus> {
  const profile = await prisma.cleanerProfile.findUnique({
    where: { userId: cleanerId },
    select: { acknowledgmentVersion: true },
  });
  const acknowledgedVersion = profile?.acknowledgmentVersion ?? null;
  return {
    currentVersion: CURRENT_AGREEMENT_VERSION,
    acknowledgedVersion,
    acknowledged: acknowledgedVersion === CURRENT_AGREEMENT_VERSION,
  };
}

/**
 * Record an acknowledgment of the CURRENT version. Writes the append-only
 * evidence row (version + text hash + IP + UA + timestamp), denormalizes the
 * current version onto the profile (for the gates), and audit-logs it.
 * The version + hash are taken server-side from CURRENT_AGREEMENT — never trusted
 * from the client.
 */
export async function recordAcknowledgment(params: {
  cleanerId: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AcknowledgmentStatus> {
  const version = CURRENT_AGREEMENT_VERSION;
  const textHash = currentAgreementHash();

  const acceptance = await prisma.agreementAcceptance.create({
    data: {
      cleanerId: params.cleanerId,
      agreementType: 'self_employment',
      agreementVersion: version,
      textHash,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    },
  });

  await prisma.cleanerProfile.update({
    where: { userId: params.cleanerId },
    data: { acknowledgmentVersion: version },
  });

  await AuditService.log({
    userId: params.cleanerId,
    action: 'SETTINGS_UPDATED',
    entityType: 'AgreementAcceptance',
    entityId: acceptance.id,
    metadata: { agreementType: 'self_employment', version, textHash, kind: CURRENT_AGREEMENT.kind },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return {
    currentVersion: version,
    acknowledgedVersion: version,
    acknowledged: true,
  };
}
