import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { DocumentStorageService } from './document-storage.service';

// --- Types ---

interface VerifyExistingDBSParams {
  userId: string;
  profileId: string;
  certNumber: string;
  issueDate: string; // ISO date string (YYYY-MM-DD)
  certFileBase64: string;
  certFileName?: string;
  ipAddress?: string;
}

interface VerifyExistingDBSResult {
  success: boolean;
  status: 'verified' | 'pending_review' | 'invalid' | 'expired' | 'error';
  documentId?: string;
  message: string;
  apiCheckResult?: Record<string, unknown>;
}

interface InitiateDBSApplicationParams {
  userId: string;
  profileId: string;
  fullName: string;
  dateOfBirth: string;
  email: string;
  address: string;
  ipAddress?: string;
}

interface InitiateDBSApplicationResult {
  success: boolean;
  status: 'submitted' | 'manual_process' | 'error';
  applicationReference?: string;
  message: string;
  instructions?: string[];
}

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

// --- Constants ---

const DBS_CERT_NUMBER_REGEX = /^\d{12}$/;
const DBS_MAX_AGE_YEARS = 3;

export class DBSVerificationService {
  /**
   * Validates a DBS certificate number format (12-digit number).
   */
  private static validateCertNumber(certNumber: string): boolean {
    return DBS_CERT_NUMBER_REGEX.test(certNumber);
  }

  /**
   * Validates the DBS certificate issue date is not older than 3 years.
   */
  private static validateIssueDate(issueDate: string): { valid: boolean; message?: string } {
    const date = new Date(issueDate);
    if (isNaN(date.getTime())) {
      return { valid: false, message: 'Invalid date format. Use YYYY-MM-DD.' };
    }

    const now = new Date();
    if (date > now) {
      return { valid: false, message: 'Issue date cannot be in the future.' };
    }

    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - DBS_MAX_AGE_YEARS);

    if (date < threeYearsAgo) {
      return {
        valid: false,
        message: `DBS certificate is older than ${DBS_MAX_AGE_YEARS} years. A new certificate is required.`,
      };
    }

    return { valid: true };
  }

  /**
   * Calls the DBS Update Service API to check certificate status.
   * Returns null if the API is not configured (manual review fallback).
   */
  private static async checkDBSUpdateService(
    certNumber: string
  ): Promise<{ status: string; result: Record<string, unknown> } | null> {
    const apiKey = process.env.DBS_UPDATE_SERVICE_API_KEY;
    const apiUrl = process.env.DBS_UPDATE_SERVICE_URL;

    if (!apiKey || !apiUrl) {
      return null;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ certificateNumber: certNumber }),
    });

    if (!response.ok) {
      throw new Error(`DBS Update Service returned ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.status, // e.g. 'current', 'changed', 'not_found'
      result: data,
    };
  }

  /**
   * Verifies an existing DBS certificate.
   *
   * Validates the cert number format and issue date, stores the certificate
   * document securely, and checks the DBS Update Service API if configured.
   * Falls back to manual review when the API is not available.
   */
  static async verifyExistingDBS(params: VerifyExistingDBSParams): Promise<VerifyExistingDBSResult> {
    const { userId, profileId, certNumber, issueDate, certFileBase64, certFileName, ipAddress } =
      params;

    // Validate cert number format
    if (!this.validateCertNumber(certNumber)) {
      await AuditService.log({
        userId,
        action: 'DBS_VERIFICATION_ATTEMPTED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: {
          reason: 'invalid_cert_number_format',
          certNumberPrefix: certNumber.substring(0, 4) + '********',
        },
        ipAddress,
      });

      return {
        success: false,
        status: 'invalid',
        message: 'DBS certificate number must be a 12-digit number.',
      };
    }

    // Validate issue date
    const dateValidation = this.validateIssueDate(issueDate);
    if (!dateValidation.valid) {
      await AuditService.log({
        userId,
        action: 'DBS_VERIFICATION_ATTEMPTED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: { reason: 'invalid_issue_date', message: dateValidation.message },
        ipAddress,
      });

      return {
        success: false,
        status: dateValidation.message?.includes('older') ? 'expired' : 'invalid',
        message: dateValidation.message || 'Invalid issue date.',
      };
    }

    // Store the certificate document via DocumentStorageService
    const fileBuffer = Buffer.from(certFileBase64, 'base64');
    const docResult = await DocumentStorageService.uploadDocument({
      userId,
      profileId,
      documentType: 'dbs_certificate',
      fileBuffer,
      originalName: certFileName || 'dbs-certificate.pdf',
      mimeType: 'application/pdf',
      metadata: {
        certNumber: certNumber.substring(0, 4) + '********',
        issueDate,
      },
      ipAddress,
    });

    // Attempt DBS Update Service API check
    let apiCheckResult: Record<string, unknown> | undefined;
    let verified = false;
    let pendingManualReview = false;

    try {
      const apiResult = await this.checkDBSUpdateService(certNumber);

      if (apiResult) {
        apiCheckResult = apiResult.result;

        if (apiResult.status === 'current') {
          verified = true;
        } else if (apiResult.status === 'changed') {
          // Certificate info has changed — needs manual review
          pendingManualReview = true;
        } else {
          // Not found or other status — needs manual review
          pendingManualReview = true;
        }
      } else {
        // API not configured — fall back to manual review
        pendingManualReview = true;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      pendingManualReview = true;
      apiCheckResult = { error: errorMessage };
    }

    // Update CleanerProfile
    const profileUpdate: Record<string, unknown> = {
      dbsCertNumber: certNumber,
      dbsCertIssueDate: new Date(issueDate),
      verificationMeta: {
        dbsDocumentId: docResult.id,
        dbsApiCheckResult: apiCheckResult || null,
        dbsSubmittedAt: new Date().toISOString(),
        ...(verified ? { dbsVerifiedVia: 'api' } : { dbsVerifiedVia: 'pending_manual_review' }),
      },
    };

    if (verified) {
      profileUpdate.dbsCertVerified = true;
      profileUpdate.backgroundCheckPassed = true;
      profileUpdate.verificationStatus = 'VERIFIED';
    } else if (pendingManualReview) {
      profileUpdate.verificationStatus = 'PENDING';
    }

    await prisma.cleanerProfile.update({
      where: { id: profileId },
      data: profileUpdate,
    });

    // Audit log the verification result
    await AuditService.log({
      userId,
      action: verified ? 'DBS_CERT_VERIFIED' : 'DBS_VERIFICATION_ATTEMPTED',
      entityType: 'CleanerProfile',
      entityId: profileId,
      metadata: {
        certNumber: certNumber.substring(0, 4) + '********',
        issueDate,
        documentId: docResult.id,
        verified,
        pendingManualReview,
        apiConfigured: !!process.env.DBS_UPDATE_SERVICE_API_KEY,
      },
      ipAddress,
    });

    if (verified) {
      return {
        success: true,
        status: 'verified',
        documentId: docResult.id,
        message: 'DBS certificate verified successfully via the DBS Update Service.',
        apiCheckResult,
      };
    }

    return {
      success: true,
      status: 'pending_review',
      documentId: docResult.id,
      message:
        'DBS certificate uploaded successfully. It will be reviewed by our verification team.',
      apiCheckResult,
    };
  }

  /**
   * Initiates a new DBS application for a cleaner who does not have a certificate.
   *
   * Integrates with a DBS umbrella body API if configured, otherwise returns
   * instructions for the manual application process.
   */
  static async initiateDBSApplication(
    params: InitiateDBSApplicationParams
  ): Promise<InitiateDBSApplicationResult> {
    const { userId, profileId, fullName, dateOfBirth, email, address, ipAddress } = params;

    const apiKey = process.env.DBS_UMBRELLA_API_KEY;
    const apiUrl = process.env.DBS_UMBRELLA_API_URL;

    if (!apiKey || !apiUrl) {
      // Fall back to manual process instructions
      await AuditService.log({
        userId,
        action: 'DBS_APPLICATION_INITIATED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: { method: 'manual_process', reason: 'api_not_configured' },
        ipAddress,
      });

      await prisma.cleanerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: 'PENDING',
          verificationMeta: {
            dbsApplicationMethod: 'manual',
            dbsApplicationInitiatedAt: new Date().toISOString(),
          },
        },
      });

      return {
        success: true,
        status: 'manual_process',
        message:
          'DBS Update Service API is not configured. Please follow the manual application steps.',
        instructions: [
          'Visit https://www.gov.uk/request-copy-criminal-record to apply for a basic DBS check.',
          'Alternatively, apply through an umbrella body registered with the DBS.',
          'The check typically costs around £18 for a basic disclosure.',
          'Processing usually takes 14 days.',
          'Once you receive your certificate, upload it through the verification page.',
        ],
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
          fullName,
          dateOfBirth,
          email,
          address,
          checkLevel: 'enhanced', // cleaning roles typically require enhanced DBS
          workforce: 'adult',
        }),
      });

      if (!response.ok) {
        throw new Error(`DBS Umbrella Body API returned ${response.status}`);
      }

      const data = await response.json();

      await prisma.cleanerProfile.update({
        where: { id: profileId },
        data: {
          verificationStatus: 'PENDING',
          verificationMeta: {
            dbsApplicationMethod: 'umbrella_body',
            dbsApplicationReference: data.applicationReference,
            dbsApplicationSubmittedAt: new Date().toISOString(),
          },
        },
      });

      await AuditService.log({
        userId,
        action: 'DBS_APPLICATION_INITIATED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: {
          method: 'umbrella_body',
          applicationReference: data.applicationReference,
        },
        ipAddress,
      });

      return {
        success: true,
        status: 'submitted',
        applicationReference: data.applicationReference,
        message:
          'DBS application submitted successfully. You will receive an email with next steps.',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await AuditService.log({
        userId,
        action: 'DBS_APPLICATION_INITIATED',
        entityType: 'CleanerProfile',
        entityId: profileId,
        metadata: { method: 'umbrella_body', error: errorMessage },
        ipAddress,
      });

      return {
        success: false,
        status: 'error',
        message: `Failed to submit DBS application: ${errorMessage}`,
      };
    }
  }

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
          ? profile.dbsCertNumber.substring(0, 4) + '********'
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
