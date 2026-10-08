import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { log } from '@/lib/log';
import { putObject, getObject, deleteObject } from '@/lib/storage/r2-client';
import {
  encryptDocument,
  decryptDocument,
  computeChecksum,
  generateKeyId,
} from '@/lib/utils/document-encryption';

import { AuditService } from './audit.service';

export type DocumentType =
  | 'dbs_certificate'
  | 'right_to_work'
  | 'photo_id'
  | 'insurance'
  | 'selfie'
  | 'profile_photo';

interface UploadDocumentParams {
  userId: string;
  profileId?: string;
  documentType: DocumentType;
  fileBuffer: Buffer;
  originalName: string;
  mimeType: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  /** RENA-101: DRAFT for an unfinished application's documents. */
  reviewState?: 'DRAFT' | 'SUBMITTED';
  /**
   * RENA-101: draft replacement hook. Runs in the transaction that marks the
   * new row STORED (so the old row's destroy and the new row's arrival are
   * one step, guarded by the one-active-draft index). Returns the storage path
   * of any object it retired, removed after commit.
   */
  onStored?: (tx: Prisma.TransactionClient, newId: string) => Promise<string | null>;
}

interface DocumentResult {
  id: string;
  documentType: string;
  originalName: string;
  isVerified: boolean;
  createdAt: Date;
}

export class DocumentStorageService {
  /**
   * Uploads and encrypts a document, storing it in R2.
   *
   * RENA-101: traceable two-phase write. The row is created PENDING (with its
   * server-generated object key) BEFORE the object is written, then marked
   * STORED. A crash between the two leaves a PENDING row that the stale-upload
   * sweep finds and clears with its object, so no object is ever untracked.
   */
  static async uploadDocument(params: UploadDocumentParams): Promise<DocumentResult> {
    const keyId = generateKeyId();
    const checksum = computeChecksum(params.fileBuffer);
    const encrypted = encryptDocument(params.fileBuffer, keyId);

    const ext = params.originalName.includes('.')
      ? params.originalName.substring(params.originalName.lastIndexOf('.'))
      : '';
    const objectKey = `documents/${params.documentType}/${keyId}${ext}.enc`;

    const pending = await prisma.documentUpload.create({
      data: {
        userId: params.userId,
        profileId: params.profileId,
        documentType: params.documentType,
        originalName: params.originalName,
        storagePath: objectKey,
        mimeType: params.mimeType,
        fileSize: params.fileBuffer.length,
        encryptionKeyId: keyId,
        checksum,
        expiresAt: params.expiresAt,
        metadata: params.metadata as Record<string, string> | undefined,
        storageState: 'PENDING',
        reviewState: params.reviewState ?? 'SUBMITTED',
      },
    });

    try {
      await putObject(objectKey, encrypted, 'application/octet-stream');
    } catch (err) {
      // Nothing was stored: the reservation goes too (the sweep is the net if
      // this delete itself fails).
      await prisma.documentUpload.delete({ where: { id: pending.id } }).catch(() => {});
      throw err;
    }

    let retiredPath: string | null = null;
    let doc;
    try {
      doc = await prisma.$transaction(async (tx) => {
        retiredPath = params.onStored ? await params.onStored(tx, pending.id) : null;
        return tx.documentUpload.update({
          where: { id: pending.id },
          data: { storageState: 'STORED' },
        });
      });
    } catch (err) {
      // The object is written but may not become active (a replacement race
      // or a refused hook): remove it and record the row as destroyed.
      await deleteObject(objectKey)
        .then(() =>
          prisma.documentUpload.update({
            where: { id: pending.id },
            data: {
              isDestroyed: true,
              destroyedAt: new Date(),
              destroyedReason: 'upload_not_activated',
              storageState: 'DELETED',
            },
          })
        )
        .catch(() => {});
      throw err;
    }
    if (retiredPath) await DocumentStorageService.removeRetiredObject(retiredPath);

    const auditAction =
      params.documentType === 'dbs_certificate'
        ? 'DBS_CERT_UPLOADED'
        : params.documentType === 'right_to_work'
          ? 'RTW_DOC_UPLOADED'
          : 'DOCUMENT_UPLOADED';

    await AuditService.log({
      userId: params.userId,
      action: auditAction,
      entityType: 'DocumentUpload',
      entityId: doc.id,
      metadata: {
        documentType: params.documentType,
        originalName: params.originalName,
        mimeType: params.mimeType,
        fileSize: params.fileBuffer.length,
        checksum,
      },
      ipAddress: params.ipAddress,
    });

    return {
      id: doc.id,
      documentType: doc.documentType,
      originalName: doc.originalName,
      isVerified: doc.isVerified,
      createdAt: doc.createdAt,
    };
  }

  /**
   * Retrieves and decrypts a document from R2 (admin only).
   */
  static async getDocument(
    documentId: string,
    requestedBy: string,
    ipAddress?: string
  ): Promise<{ buffer: Buffer; mimeType: string; originalName: string } | null> {
    const doc = await prisma.documentUpload.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.isDestroyed || doc.storageState !== 'STORED') return null;

    const encrypted = await getObject(doc.storagePath);
    const decrypted = decryptDocument(encrypted, doc.encryptionKeyId);

    const currentChecksum = computeChecksum(decrypted);
    if (currentChecksum !== doc.checksum) {
      throw new Error('Document integrity check failed — file may have been tampered with');
    }

    const auditAction =
      doc.documentType === 'dbs_certificate'
        ? 'DBS_CERT_VIEWED'
        : doc.documentType === 'right_to_work'
          ? 'RTW_DOC_VIEWED'
          : 'DOCUMENT_DOWNLOADED';

    await AuditService.log({
      userId: requestedBy,
      action: auditAction,
      entityType: 'DocumentUpload',
      entityId: documentId,
      metadata: { documentType: doc.documentType },
      ipAddress,
    });

    return {
      buffer: decrypted,
      mimeType: doc.mimeType,
      originalName: doc.originalName,
    };
  }

  /**
   * Destroys a document by deleting it from R2 and marking the DB record.
   *
   * R2 is object storage — overwriting with random bytes writes to new storage
   * regions while old ciphertext may persist until internal reclamation. The
   * overwrite provides no real security guarantee. Instead we rely on crypto-
   * shredding: the per-document encryption key is derived from the master key
   * plus encryptionKeyId. Once this row is marked destroyed and the object
   * deleted, the ciphertext is unrecoverable even if storage media is not
   * immediately wiped.
   */
  static async destroyDocument(
    documentId: string,
    reason: string,
    performedBy: string
  ): Promise<void> {
    const doc = await prisma.documentUpload.findUnique({
      where: { id: documentId },
    });

    if (!doc || doc.isDestroyed) return;

    // RENA-101: DELETED is recorded only when the object delete succeeded; a
    // failed delete leaves the row destroyed but STORED, which the sweep
    // retries until the object is gone.
    let objectGone = false;
    try {
      await deleteObject(doc.storagePath);
      objectGone = true;
    } catch {
      log.error('document_storage', 'destroy_object_failed', { documentId });
    }

    await prisma.documentUpload.update({
      where: { id: documentId },
      data: {
        isDestroyed: true,
        destroyedAt: new Date(),
        destroyedReason: reason,
        ...(objectGone ? { storageState: 'DELETED' as const } : {}),
      },
    });

    const auditAction =
      doc.documentType === 'dbs_certificate'
        ? 'DBS_CERT_DESTROYED'
        : doc.documentType === 'right_to_work'
          ? 'RTW_DOC_DESTROYED'
          : 'DOCUMENT_DESTROYED';

    await AuditService.log({
      userId: performedBy,
      action: auditAction,
      entityType: 'DocumentUpload',
      entityId: documentId,
      metadata: { reason, documentType: doc.documentType },
    });

    await prisma.dataRetentionLog.create({
      data: {
        entityType: 'DocumentUpload',
        entityId: documentId,
        action: 'DELETED',
        reason,
        performedBy,
        metadata: {
          documentType: doc.documentType,
          originalName: doc.originalName,
          userId: doc.userId,
        },
      },
    });
  }

  /**
   * RENA-101: removes an object a replacement retired and records DELETED.
   * A failure leaves the destroyed row STORED for the sweep to retry.
   */
  static async removeRetiredObject(storagePath: string): Promise<void> {
    try {
      await deleteObject(storagePath);
      await prisma.documentUpload.updateMany({
        where: { storagePath, isDestroyed: true },
        data: { storageState: 'DELETED' },
      });
    } catch {
      log.error('document_storage', 'retired_object_delete_failed', {});
    }
  }

  /**
   * RENA-101: the integrity sweep. (1) PENDING rows older than the cutoff are
   * interrupted uploads: their object (if any) is deleted, then the row. (2)
   * destroyed rows still marked STORED had an object delete fail: retried.
   * Idempotent; each pass converges.
   */
  static async sweepIncompleteUploads(
    now: Date = new Date(),
    staleAfterMs = 60 * 60 * 1000
  ): Promise<{ pendingCleared: number; retiredDeleted: number }> {
    const cutoff = new Date(now.getTime() - staleAfterMs);
    let pendingCleared = 0;
    let retiredDeleted = 0;
    const pending = await prisma.documentUpload.findMany({
      where: { storageState: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true, storagePath: true },
      take: 100,
    });
    for (const row of pending) {
      try {
        await deleteObject(row.storagePath);
        await prisma.documentUpload.deleteMany({ where: { id: row.id, storageState: 'PENDING' } });
        pendingCleared += 1;
      } catch {
        log.error('document_storage', 'pending_sweep_failed', { documentId: row.id });
      }
    }
    const retired = await prisma.documentUpload.findMany({
      where: { isDestroyed: true, storageState: 'STORED', destroyedAt: { lt: cutoff } },
      select: { id: true, storagePath: true },
      take: 100,
    });
    for (const row of retired) {
      try {
        await deleteObject(row.storagePath);
        await prisma.documentUpload.update({
          where: { id: row.id },
          data: { storageState: 'DELETED' },
        });
        retiredDeleted += 1;
      } catch {
        log.error('document_storage', 'retired_sweep_failed', { documentId: row.id });
      }
    }
    return { pendingCleared, retiredDeleted };
  }

  /**
   * Get all documents for a cleaner profile, excluding destroyed ones.
   */
  static async getDocumentsForProfile(profileId: string): Promise<DocumentResult[]> {
    const docs = await prisma.documentUpload.findMany({
      where: { profileId, isDestroyed: false, storageState: 'STORED' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        documentType: true,
        originalName: true,
        isVerified: true,
        verifiedAt: true,
        verifiedBy: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return docs;
  }

  /**
   * Get documents pending verification (for admin queue).
   */
  static async getPendingVerification(documentType?: DocumentType) {
    const where: Record<string, unknown> = {
      isVerified: false,
      isDestroyed: false,
    };
    if (documentType) where.documentType = documentType;

    return prisma.documentUpload.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        userId: true,
        profileId: true,
        documentType: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        expiresAt: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Admin verifies or rejects a document.
   */
  static async verifyDocument(
    documentId: string,
    adminId: string,
    approved: boolean,
    ipAddress?: string,
    reason?: string
  ): Promise<void> {
    const doc = await prisma.documentUpload.findUnique({
      where: { id: documentId },
    });

    if (!doc) throw new Error('Document not found');

    if (!approved) {
      // Persist the rejection so the queue chip flips and the cleaner sees why.
      await prisma.documentUpload.update({
        where: { id: documentId },
        data: {
          isVerified: false,
          rejectedAt: new Date(),
          rejectionReason: reason?.trim() || 'Document rejected — please re-upload.',
          reviewState: 'REJECTED',
        },
      });
    }

    if (approved) {
      await prisma.documentUpload.update({
        where: { id: documentId },
        data: {
          isVerified: true,
          verifiedBy: adminId,
          verifiedAt: new Date(),
          rejectedAt: null,
          rejectionReason: null,
          reviewState: 'VERIFIED',
        },
      });

      if (doc.profileId) {
        if (doc.documentType === 'dbs_certificate') {
          await prisma.cleanerProfile.update({
            where: { id: doc.profileId },
            data: {
              dbsCertVerified: true,
              backgroundCheckPassed: true,
            },
          });
        } else if (doc.documentType === 'right_to_work') {
          await prisma.cleanerProfile.update({
            where: { id: doc.profileId },
            data: {
              rightToWorkStatus: 'VERIFIED',
              rightToWorkVerifiedAt: new Date(),
            },
          });
        } else if (doc.documentType === 'insurance') {
          // Two-stage flow: insurance approval is a GO-LIVE item. This was the
          // missing write — nothing ever set insuranceVerified before.
          await prisma.cleanerProfile.update({
            where: { id: doc.profileId },
            data: {
              insuranceVerified: true,
              insuranceVerifiedAt: new Date(),
              ...(doc.expiresAt ? { insuranceExpiresAt: doc.expiresAt } : {}),
            },
          });
          const { maybeMarkLive } = await import('./go-live.service');
          void maybeMarkLive(doc.userId);
        }
      }
    }

    const auditAction =
      doc.documentType === 'dbs_certificate'
        ? approved
          ? 'DBS_CERT_VERIFIED'
          : 'DBS_CERT_REJECTED'
        : doc.documentType === 'right_to_work'
          ? approved
            ? 'RTW_DOC_VERIFIED'
            : 'RTW_DOC_REJECTED'
          : 'ADMIN_ACTION';

    await AuditService.log({
      userId: adminId,
      action: auditAction,
      entityType: 'DocumentUpload',
      entityId: documentId,
      metadata: {
        approved,
        documentType: doc.documentType,
        cleanerUserId: doc.userId,
        ...(reason ? { reason } : {}),
      },
      ipAddress,
    });
  }
}
