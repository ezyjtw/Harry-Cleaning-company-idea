import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { DocumentStorageService } from './document-storage.service';

// --- Types ---

interface LivenessCheckParams {
  userId: string;
  profileId: string;
  selfieImageBase64: string;
  idImageBase64: string;
  fullName: string;
  dateOfBirth?: string;
  documentNumber?: string;
  ipAddress?: string;
}

interface LivenessCheckResult {
  success: boolean;
  status: 'match' | 'no_match' | 'pending_review' | 'error';
  confidenceScore?: number;
  message: string;
}

interface VerificationStatusResult {
  dbs: {
    certVerified: boolean;
    certNumber: string | null;
    certIssueDate: Date | null;
    certDestroyedAt: Date | null;
    backgroundCheckPassed: boolean;
  };
  identity: {
    verificationStatus: string;
    identityVerifiedAt: Date | null;
  };
  verificationMeta: Record<string, unknown> | null;
}

export class DBSVerificationService {
  /**
   * Performs a liveness/identity verification check.
   *
   * Compares a selfie against a photo ID using an identity verification provider
   * (e.g. Yoti, Onfido). Falls back to storing images for manual review if the
   * API is not configured.
   */
  static async performLivenessCheck(params: LivenessCheckParams): Promise<LivenessCheckResult> {
    const {
      userId,
      profileId,
      selfieImageBase64,
      idImageBase64,
      fullName,
      dateOfBirth,
      documentNumber,
      ipAddress,
    } = params;

    // Store the selfie and ID images securely
    const selfieBuffer = Buffer.from(selfieImageBase64, 'base64');
    const idBuffer = Buffer.from(idImageBase64, 'base64');

    const [selfieDoc, idDoc] = await Promise.all([
      DocumentStorageService.uploadDocument({
        userId,
        profileId,
        documentType: 'photo_id',
        fileBuffer: selfieBuffer,
        originalName: 'liveness-selfie.jpg',
        mimeType: 'image/jpeg',
        metadata: { purpose: 'liveness_check_selfie' },
        ipAddress,
      }),
      DocumentStorageService.uploadDocument({
        userId,
        profileId,
        documentType: 'photo_id',
        fileBuffer: idBuffer,
        originalName: 'identity-document.jpg',
        mimeType: 'image/jpeg',
        metadata: { purpose: 'liveness_check_id' },
        ipAddress,
      }),
    ]);

    const apiKey = process.env.IDENTITY_VERIFY_API_KEY;
    const apiUrl = process.env.IDENTITY_VERIFY_API_URL;

    if (!apiKey || !apiUrl) {
      // Fall back to manual review
      await prisma.cleanerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: 'PENDING',
          verificationMeta: {
            identityCheckMethod: 'manual_review',
            selfieDocumentId: selfieDoc.id,
            idDocumentId: idDoc.id,
            identityCheckSubmittedAt: new Date().toISOString(),
          },
        },
      });

      await AuditService.log({
        userId,
        action: 'IDENTITY_CHECK_SUBMITTED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: {
          method: 'manual_review',
          reason: 'identity_api_not_configured',
          selfieDocumentId: selfieDoc.id,
          idDocumentId: idDoc.id,
        },
        ipAddress,
      });

      return {
        success: true,
        status: 'pending_review',
        message:
          'Identity documents uploaded for manual review. Our team will verify your identity.',
      };
    }

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          selfieImage: selfieImageBase64,
          documentImage: idImageBase64,
          fullName,
          dateOfBirth,
          documentNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Identity verification API returned ${response.status}`);
      }

      const data = await response.json();
      const confidenceScore: number = data.confidenceScore ?? 0;
      const isMatch = data.match === true && confidenceScore >= 0.8;

      // Update profile based on result
      const profileUpdate: Record<string, unknown> = {
        verificationMeta: {
          identityCheckMethod: 'api',
          selfieDocumentId: selfieDoc.id,
          idDocumentId: idDoc.id,
          identityConfidenceScore: confidenceScore,
          identityMatch: isMatch,
          identityCheckCompletedAt: new Date().toISOString(),
        },
      };

      if (isMatch) {
        profileUpdate.identityVerifiedAt = new Date();
        profileUpdate.verificationStatus = 'VERIFIED';
      }

      await prisma.cleanerProfile.update({
        where: { id: profileId },
        data: profileUpdate,
      });

      await AuditService.log({
        userId,
        action: isMatch ? 'IDENTITY_CHECK_PASSED' : 'IDENTITY_CHECK_FAILED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: {
          method: 'api',
          confidenceScore,
          match: isMatch,
          selfieDocumentId: selfieDoc.id,
          idDocumentId: idDoc.id,
        },
        ipAddress,
      });

      return {
        success: true,
        status: isMatch ? 'match' : 'no_match',
        confidenceScore,
        message: isMatch
          ? 'Identity verified successfully.'
          : 'Identity check did not produce a confident match. Manual review may be required.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await AuditService.log({
        userId,
        action: 'IDENTITY_CHECK_SUBMITTED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: {
          method: 'api',
          error: errorMessage,
          selfieDocumentId: selfieDoc.id,
          idDocumentId: idDoc.id,
        },
        ipAddress,
      });

      return {
        success: false,
        status: 'error',
        message: `Identity verification failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Returns the current DBS and identity verification status for a user.
   */
  static async getVerificationStatus(userId: string): Promise<VerificationStatusResult | null> {
    const profile = await prisma.cleanerProfile.findUnique({
      where: { userId },
      select: {
        dbsCertVerified: true,
        dbsCertNumber: true,
        dbsCertIssueDate: true,
        dbsCertDestroyedAt: true,
        backgroundCheckPassed: true,
        verificationStatus: true,
        identityVerifiedAt: true,
        verificationMeta: true,
      },
    });

    if (!profile) return null;

    return {
      dbs: {
        certVerified: profile.dbsCertVerified,
        certNumber: profile.dbsCertNumber
          ? `${profile.dbsCertNumber.substring(0, 4)}********`
          : null,
        certIssueDate: profile.dbsCertIssueDate,
        certDestroyedAt: profile.dbsCertDestroyedAt,
        backgroundCheckPassed: profile.backgroundCheckPassed,
      },
      identity: {
        verificationStatus: profile.verificationStatus,
        identityVerifiedAt: profile.identityVerifiedAt,
      },
      verificationMeta: (profile.verificationMeta as Record<string, unknown>) ?? null,
    };
  }
}
