import { prisma } from '@/lib/db/prisma';

import { AuditService } from './audit.service';
import { DocumentStorageService } from './document-storage.service';

export type ConsentType = 'marketing' | 'analytics' | 'essential' | 'data_processing';

interface RecordConsentParams {
  userId?: string;
  email: string;
  consentType: ConsentType;
  granted: boolean;
  ipAddress?: string;
  userAgent?: string;
  version?: string;
}

export class GdprService {
  /**
   * Record a consent decision (grant or revoke)
   */
  static async recordConsent(params: RecordConsentParams) {
    const consent = await prisma.gdprConsent.create({
      data: {
        userId: params.userId,
        email: params.email,
        consentType: params.consentType,
        granted: params.granted,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        version: params.version ?? '1.0',
        revokedAt: params.granted ? null : new Date(),
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'GdprConsent',
      entityId: consent.id,
      metadata: {
        consentType: params.consentType,
        granted: params.granted,
        email: params.email,
      },
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    return consent;
  }

  /**
   * Record multiple consent decisions at once (e.g. cookie banner)
   */
  static async recordBulkConsent(params: {
    userId?: string;
    email: string;
    consents: { type: ConsentType; granted: boolean }[];
    ipAddress?: string;
    userAgent?: string;
    version?: string;
  }) {
    const results = await Promise.all(
      params.consents.map((consent) =>
        this.recordConsent({
          userId: params.userId,
          email: params.email,
          consentType: consent.type,
          granted: consent.granted,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          version: params.version,
        })
      )
    );

    return results;
  }

  /**
   * Get current consent status for a user/email
   */
  static async getConsentStatus(params: { userId?: string; email?: string }) {
    if (!params.userId && !params.email) {
      throw new Error('Either userId or email must be provided');
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const where = params.userId ? { userId: params.userId } : { email: params.email! };

    // Get the latest consent record for each type
    const consents = await prisma.gdprConsent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Build current status from most recent of each type
    const status: Record<string, { granted: boolean; updatedAt: Date; version: string }> = {};

    for (const consent of consents) {
      if (!status[consent.consentType]) {
        status[consent.consentType] = {
          granted: consent.granted,
          updatedAt: consent.createdAt,
          version: consent.version,
        };
      }
    }

    return status;
  }

  /**
   * H103 (James-ruled spec): a CLEANER may not enter the deletion pipeline
   * while anything live hangs off their account. Every blocker is STRUCTURAL —
   * checked server-side against the data, never UI trust — and each names the
   * action that clears it. Checked at request time AND again at execution.
   */
  static async getCleanerDeletionBlockers(userId: string): Promise<string[]> {
    const { BookingStatus } = await import('@prisma/client');
    const LIVE_STATUSES = [
      BookingStatus.PENDING,
      BookingStatus.AWAITING_CLEANER,
      BookingStatus.CONFIRMED,
      BookingStatus.ACCEPTED,
      BookingStatus.EN_ROUTE,
      BookingStatus.IN_PROGRESS,
      BookingStatus.CLEANER_CANCELLED,
    ];
    const [liveJobs, activeAgreements, moneyInFlight, openDisputes, pendingTopups] =
      await Promise.all([
        prisma.booking.count({ where: { cleanerId: userId, status: { in: LIVE_STATUSES } } }),
        prisma.recurringAgreement.count({ where: { cleanerId: userId, status: 'ACTIVE' } }),
        prisma.booking.count({
          where: {
            cleanerId: userId,
            status: { in: ['COMPLETED', 'REVIEWED'] },
            transferStatus: 'PENDING',
          },
        }),
        prisma.dispute.count({
          where: { booking: { cleanerId: userId }, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
        }),
        prisma.topupRecord.count({
          where: { booking: { cleanerId: userId }, status: 'PENDING' },
        }),
      ]);

    const blockers: string[] = [];
    if (liveJobs > 0) {
      blockers.push(
        `${liveJobs} upcoming or in-progress booking(s) — complete or cancel them first`
      );
    }
    if (activeAgreements > 0) {
      blockers.push(
        `${activeAgreements} active regular-clean arrangement(s) — end them first (your customers are told honestly)`
      );
    }
    if (moneyInFlight > 0) {
      blockers.push(
        `${moneyInFlight} completed clean(s) with your payout still in flight — wait for release`
      );
    }
    if (openDisputes > 0) {
      blockers.push(`${openDisputes} open dispute(s) — they must resolve first`);
    }
    if (pendingTopups > 0) {
      blockers.push(`${pendingTopups} pending payment adjustment(s) — they must settle first`);
    }
    return blockers;
  }

  /**
   * H103 follow-up (James-ruled): the same hole existed identically on the
   * CLIENT side — a customer deleting mid-booking strands a cleaner's
   * committed slot. Same door, same engine, role-appropriate blockers.
   */
  static async getClientDeletionBlockers(userId: string): Promise<string[]> {
    const { BookingStatus } = await import('@prisma/client');
    const LIVE_STATUSES = [
      BookingStatus.PENDING,
      BookingStatus.AWAITING_CLEANER,
      BookingStatus.CONFIRMED,
      BookingStatus.ACCEPTED,
      BookingStatus.EN_ROUTE,
      BookingStatus.IN_PROGRESS,
      // A rescue-in-flight clean is live for the customer too — their money
      // and their choice (reschedule/cover/refund) are both still open.
      BookingStatus.CLEANER_CANCELLED,
    ];
    const [liveBookings, activeAgreements, openDisputes] = await Promise.all([
      prisma.booking.count({ where: { clientId: userId, status: { in: LIVE_STATUSES } } }),
      prisma.recurringAgreement.count({ where: { clientId: userId, status: 'ACTIVE' } }),
      prisma.dispute.count({
        where: { booking: { clientId: userId }, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    const blockers: string[] = [];
    if (liveBookings > 0) {
      blockers.push(`${liveBookings} upcoming clean(s) — complete or cancel them first`);
    }
    if (activeAgreements > 0) {
      blockers.push(`${activeAgreements} regular arrangement(s) — end them first`);
    }
    if (openDisputes > 0) {
      blockers.push(`${openDisputes} open dispute(s) — they must resolve first`);
    }
    return blockers;
  }

  /**
   * Submit a data deletion request (GDPR right to erasure)
   */
  static async requestDataDeletion(params: { userId: string; email: string; reason?: string }) {
    const request = await prisma.dataDeletionRequest.create({
      data: {
        userId: params.userId,
        email: params.email,
        reason: params.reason,
      },
    });

    await AuditService.log({
      userId: params.userId,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: request.id,
      metadata: { action: 'DATA_DELETION_REQUESTED', email: params.email },
    });

    return request;
  }

  /**
   * Admin approves a pending deletion request (PENDING → APPROVED). This is the
   * mandatory gate: execution (processDataDeletion) refuses to run until a
   * request is APPROVED. Erasure is irreversible, so it never runs unattended.
   */
  static async approveDataDeletion(params: { requestId: string; adminId: string }) {
    const claim = await prisma.dataDeletionRequest.updateMany({
      where: { id: params.requestId, status: 'PENDING' },
      data: { status: 'APPROVED', processedBy: params.adminId },
    });
    if (claim.count === 0) {
      throw new Error('Request not found or not in PENDING state');
    }

    await AuditService.log({
      userId: params.adminId,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: params.requestId,
      metadata: { action: 'DATA_DELETION_APPROVED' },
    });

    return { success: true };
  }

  /**
   * Admin rejects a deletion request (from PENDING or APPROVED → REJECTED).
   */
  static async rejectDataDeletion(params: { requestId: string; adminId: string; notes?: string }) {
    const claim = await prisma.dataDeletionRequest.updateMany({
      where: { id: params.requestId, status: { in: ['PENDING', 'APPROVED'] } },
      data: { status: 'REJECTED', processedBy: params.adminId, notes: params.notes },
    });
    if (claim.count === 0) {
      throw new Error('Request not found or already processed');
    }

    await AuditService.log({
      userId: params.adminId,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: params.requestId,
      metadata: { action: 'DATA_DELETION_REJECTED', notes: params.notes },
    });

    return { success: true };
  }

  /**
   * Deletion requests an admin can act on (queue + in-flight), newest first.
   */
  static async getManageableDeletionRequests() {
    return prisma.dataDeletionRequest.findMany({
      where: { status: { in: ['PENDING', 'APPROVED', 'IN_PROGRESS'] } },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /**
   * Execute an APPROVED deletion request — the GDPR right to erasure, applied as
   * anonymise-and-purge that respects legal retention (James-signed B4 matrix):
   *  - User identity → tombstoned (row kept so FK-linked bookings/payments
   *    survive the 6-year tax/legal retention).
   *  - Addresses → hard-deleted.
   *  - Identity docs (photo_id/selfie/insurance) → R2-destroyed now; RTW and DBS
   *    are DEFERRED to their statutory retention windows, never cancelled.
   *  - Messages → content redacted (counterpart thread preserved).
   *  - Reviews → author anonymised via the user tombstone; text kept for cleaner
   *    rating integrity.
   *  - Analytics → userId + ipAddress nulled.
   *  - Marketing/consent → all granted consents withdrawn.
   *
   * Refuses to run unless the request is APPROVED, and atomically claims
   * APPROVED → IN_PROGRESS so it cannot double-run.
   */
  static async processDataDeletion(params: { requestId: string; processedBy: string }) {
    const request = await prisma.dataDeletionRequest.findUnique({
      where: { id: params.requestId },
    });

    if (!request) throw new Error('Deletion request not found');
    if (request.status !== 'APPROVED') {
      throw new Error('Request must be APPROVED by an admin before it can be executed');
    }

    // Atomic claim: APPROVED → IN_PROGRESS. Guards against the admin action and
    // the daily safety-net sweep both picking up the same request.
    const claim = await prisma.dataDeletionRequest.updateMany({
      where: { id: params.requestId, status: 'APPROVED' },
      data: { status: 'IN_PROGRESS', processedBy: params.processedBy },
    });
    if (claim.count === 0) throw new Error('Request already being processed');

    const userId = request.userId;
    const manifest: Record<string, number | string | boolean> = {};

    // H103: the blockers are re-checked at EXECUTION time — state can change
    // between request and admin approval (a new booking, a reopened dispute).
    // Refusal reverts the claim so the admin can retry once clear.
    const requestUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, cleanerProfile: { select: { id: true, stripeAccountId: true } } },
    });
    if (requestUser?.role === 'CLEANER' || requestUser?.role === 'CLIENT') {
      const blockers =
        requestUser.role === 'CLEANER'
          ? await this.getCleanerDeletionBlockers(userId)
          : await this.getClientDeletionBlockers(userId);
      if (blockers.length > 0) {
        await prisma.dataDeletionRequest.updateMany({
          where: { id: params.requestId, status: 'IN_PROGRESS' },
          data: { status: 'APPROVED' },
        });
        throw new Error(
          `${requestUser.role === 'CLEANER' ? 'Cleaner' : 'Customer'} has live state — cannot erase yet: ${blockers.join('; ')}`
        );
      }
    }

    // 1) Identity documents. photo_id/selfie/insurance destroyed now (real R2
    //    delete via destroyDocument). right_to_work + dbs_certificate are under
    //    statutory holds — deferred to their retention jobs, never cancelled.
    const docs = await prisma.documentUpload.findMany({
      where: {
        userId,
        isDestroyed: false,
        documentType: { in: ['photo_id', 'selfie', 'insurance'] },
      },
      select: { id: true },
    });
    for (const doc of docs) {
      await DocumentStorageService.destroyDocument(doc.id, 'user_request', params.processedBy);
    }
    manifest.identityDocsDestroyed = docs.length;
    manifest.identityDocsDeferredToStatutoryWindow = await prisma.documentUpload.count({
      where: {
        userId,
        isDestroyed: false,
        documentType: { in: ['right_to_work', 'dbs_certificate'] },
      },
    });

    // 2) Messages authored by the user — redact content, keep the row so the
    //    counterpart's thread stays intact.
    const messages = await prisma.message.updateMany({
      where: { senderId: userId },
      data: { content: '[Message removed at the sender’s request]' },
    });
    manifest.messagesRedacted = messages.count;

    // 3) Analytics — strip PII, keep aggregate rows.
    const analytics = await prisma.analyticsEvent.updateMany({
      where: { userId },
      data: { userId: null, ipAddress: null },
    });
    manifest.analyticsAnonymised = analytics.count;

    // 4) Marketing / consent — withdraw every granted consent.
    const consents = await prisma.gdprConsent.updateMany({
      where: { userId, granted: true },
      data: { granted: false, revokedAt: new Date() },
    });
    manifest.consentsWithdrawn = consents.count;

    // 5) Addresses — hard delete.
    const addresses = await prisma.address.deleteMany({ where: { userId } });
    manifest.addressesDeleted = addresses.count;

    // 5b) H103 cleaner legs — profile RETIRED, not deleted (the row anchors
    //     booking history; the user tombstone below already removes it from
    //     search/matching structurally via eligibleCleanerWhere's user gate).
    if (requestUser?.role === 'CLEANER' && requestUser.cleanerProfile) {
      const profileId = requestUser.cleanerProfile.id;
      const [slots, overrides, dateSlots] = await Promise.all([
        prisma.availabilitySlot.deleteMany({ where: { cleanerProfileId: profileId } }),
        prisma.availabilityOverride.deleteMany({ where: { cleanerProfileId: profileId } }),
        prisma.availabilityDateSlot.deleteMany({ where: { cleanerProfileId: profileId } }),
      ]);
      manifest.availabilityRowsDeleted = slots.count + overrides.count + dateSlots.count;
      // Stripe Express: the account is THEIRS — we never delete it at Stripe
      // (Stripe keeps its own KYC retention; account.application.deauthorized
      // handles their side). We DETACH: the money blocker guarantees zero in
      // flight, and the old id is recorded here for the audit trail.
      manifest.stripeAccountDetached = requestUser.cleanerProfile.stripeAccountId ?? 'none';
      await prisma.cleanerProfile.update({
        where: { id: profileId },
        data: {
          bio: null,
          stripeAccountId: null,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false,
        },
      });
    }

    // 5c) H103 session kill — bump passwordChangedAt (the F6 field): every
    //     session and bearer token issued before this moment dies at the next
    //     check, and the native app goes silent with its tokens gone.
    const [deviceTokens, pushSubs] = await Promise.all([
      prisma.deviceToken.deleteMany({ where: { userId } }),
      prisma.pushSubscription.deleteMany({ where: { userId } }),
    ]);
    manifest.deviceTokensDeleted = deviceTokens.count + pushSubs.count;

    // 6) User identity — tombstone (row retained for booking/payment FK
    //    integrity under the 6-year tax/legal hold). This also anonymises the
    //    author of any retained reviews/messages.
    await prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted+${userId}@deleted.invalid`,
        name: 'Deleted user',
        phone: null,
        image: null,
        passwordHash: null,
        isDeleted: true,
        deletedAt: new Date(),
        accountStatus: 'DEACTIVATED',
        passwordChangedAt: new Date(),
      },
    });

    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'User',
        entityId: userId,
        action: 'ANONYMISED',
        reason: 'user_request',
        performedBy: params.processedBy,
        metadata: { requestId: params.requestId, ...manifest },
      },
    });

    await prisma.dataDeletionRequest.update({
      where: { id: params.requestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    await AuditService.log({
      userId: params.processedBy,
      action: 'ADMIN_ACTION',
      entityType: 'DataDeletionRequest',
      entityId: params.requestId,
      metadata: { action: 'DATA_DELETION_COMPLETED', deletedUserId: userId, ...manifest },
    });

    return { success: true, manifest };
  }

  /**
   * Export user data (GDPR right to data portability)
   */
  static async exportUserData(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        addresses: true,
        bookingsAsClient: {
          include: { review: true },
        },
        reviewsGiven: true,
        cleanerProfile: true,
      },
    });

    if (!user) throw new Error('User not found');

    // Log the export
    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'User',
        entityId: userId,
        action: 'EXPORTED',
        reason: 'user_request',
      },
    });

    await AuditService.log({
      userId,
      action: 'SETTINGS_UPDATED',
      entityType: 'User',
      entityId: userId,
      metadata: { action: 'DATA_EXPORTED' },
    });

    // Return structured data export
    return {
      personalInfo: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
      },
      addresses: user.addresses.map((a) => ({
        label: a.label,
        line1: a.line1,
        line2: a.line2,
        city: a.city,
        postcode: a.postcode,
      })),
      bookings: user.bookingsAsClient.map((b) => ({
        id: b.id,
        serviceType: b.serviceType,
        date: b.date,
        status: b.status,
        totalPrice: b.totalPrice,
        review: b.review ? { rating: b.review.rating, text: b.review.text } : null,
      })),
      cleanerProfile: user.cleanerProfile
        ? {
            bio: user.cleanerProfile.bio,
            hourlyRateRegular: user.cleanerProfile.hourlyRateRegular,
            specialties: user.cleanerProfile.specialties,
            tier: user.cleanerProfile.tier,
            location: user.cleanerProfile.location,
            postcode: user.cleanerProfile.postcode,
            radius: user.cleanerProfile.radius,
            verified: user.cleanerProfile.verified,
            verificationStatus: user.cleanerProfile.verificationStatus,
            backgroundCheckPassed: user.cleanerProfile.backgroundCheckPassed,
            dbsCertNumber: user.cleanerProfile.dbsCertNumber,
            dbsCertVerified: user.cleanerProfile.dbsCertVerified,
            dbsCertIssueDate: user.cleanerProfile.dbsCertIssueDate,
            rightToWorkStatus: user.cleanerProfile.rightToWorkStatus,
            rightToWorkDocType: user.cleanerProfile.rightToWorkDocType,
            rightToWorkExpiresAt: user.cleanerProfile.rightToWorkExpiresAt,
            identityVerifiedAt: user.cleanerProfile.identityVerifiedAt,
            rating: user.cleanerProfile.rating,
            completedJobs: user.cleanerProfile.completedJobs,
            createdAt: user.cleanerProfile.createdAt,
          }
        : null,
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Get all pending deletion requests (for admin)
   */
  static async getPendingDeletionRequests() {
    return prisma.dataDeletionRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /**
   * Run automated data retention cleanup
   * Anonymises analytics data older than the retention period
   */
  static async runRetentionCleanup(retentionDays: number = 730) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Anonymise old analytics events (keep aggregated data, remove PII)
    const updated = await prisma.analyticsEvent.updateMany({
      where: {
        createdAt: { lt: cutoffDate },
        ipAddress: { not: null },
      },
      data: {
        ipAddress: null,
        userId: null,
      },
    });

    // Log the cleanup
    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'AnalyticsEvent',
        entityId: 'batch',
        action: 'ANONYMISED',
        reason: 'retention_policy',
        performedBy: 'SYSTEM',
        metadata: {
          recordsAnonymised: updated.count,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
        },
      },
    });

    return { anonymisedCount: updated.count };
  }

  /**
   * Destroy Right to Work document files for cleaners who are no longer active.
   * Home Office guidance: retain for engagement duration plus 2 years.
   * Should be run as a scheduled job.
   */
  static async destroyExpiredRtwDocuments(maxAgeDaysAfterDeactivation: number = 730) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDaysAfterDeactivation);

    // Find deactivated/deleted users whose RTW docs are past the retention period
    const profiles = await prisma.cleanerProfile.findMany({
      where: {
        rightToWorkDocFile: { not: null },
        user: {
          OR: [
            { isDeleted: true, deletedAt: { lt: cutoffDate } },
            { accountStatus: 'DEACTIVATED', updatedAt: { lt: cutoffDate } },
          ],
        },
      },
      select: { id: true, userId: true, rightToWorkDocType: true },
    });

    let destroyedCount = 0;

    for (const profile of profiles) {
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          rightToWorkDocFile: null,
          rightToWorkShareCode: null,
        },
      });

      // Also destroy the encrypted file from DocumentUpload. Route through
      // DocumentStorageService.destroyDocument so the ciphertext is actually
      // deleted from R2 (crypto-shred) — the previous inline update only flipped
      // the isDestroyed flag and left the object in the bucket indefinitely.
      const docs = await prisma.documentUpload.findMany({
        where: {
          profileId: profile.id,
          documentType: 'right_to_work',
          isDestroyed: false,
        },
        select: { id: true },
      });

      for (const doc of docs) {
        await DocumentStorageService.destroyDocument(doc.id, 'retention_policy', 'SYSTEM');
      }

      await prisma.dataRetentionLog.create({
        data: {
          entityType: 'CleanerProfile',
          entityId: profile.id,
          action: 'DELETED',
          reason: 'retention_policy',
          performedBy: 'SYSTEM',
          metadata: {
            field: 'rightToWorkDocFile',
            docType: profile.rightToWorkDocType,
            note: 'RTW documents destroyed after engagement plus 2-year retention per Home Office guidance.',
          },
        },
      });

      await AuditService.log({
        userId: 'SYSTEM',
        action: 'RTW_DOC_DESTROYED',
        entityType: 'CleanerProfile',
        entityId: profile.id,
        metadata: {
          reason: 'retention_policy',
          docType: profile.rightToWorkDocType,
        },
      });

      destroyedCount++;
    }

    return { destroyedCount };
  }

  /**
   * Destroy DBS certificate files after verification.
   * Retains only certificate number, issue date, and verification outcome.
   * Should be run as a scheduled job — destroys certificates older than 6 months.
   */
  static async destroyVerifiedDbsCertificates(maxAgeDays: number = 180) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    // Find profiles with verified DBS certs that haven't been destroyed yet
    const profiles = await prisma.cleanerProfile.findMany({
      where: {
        dbsCertVerified: true,
        dbsCertDestroyedAt: null,
        updatedAt: { lt: cutoffDate },
      },
      select: { id: true, userId: true },
    });

    let destroyedCount = 0;

    for (const profile of profiles) {
      await prisma.cleanerProfile.update({
        where: { id: profile.id },
        data: {
          dbsCertDestroyedAt: new Date(),
          // This method records the profile-level destruction flag only. The
          // encrypted DBS file itself is deleted from R2 by the sibling loop in
          // ComplianceSchedulerService.destroyExpiredDbsCertificates, which
          // calls DocumentStorageService.destroyDocument for each expired doc.
        },
      });

      await prisma.dataRetentionLog.create({
        data: {
          entityType: 'CleanerProfile',
          entityId: profile.id,
          action: 'DELETED',
          reason: 'retention_policy',
          performedBy: 'SYSTEM',
          metadata: {
            field: 'dbsCertFile',
            note: 'DBS certificate file destroyed after verification. Certificate number and issue date retained.',
          },
        },
      });

      destroyedCount++;
    }

    return { destroyedCount };
  }
}
