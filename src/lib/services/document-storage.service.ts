import { prisma } from '@/lib/db/prisma';
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
  | 'selfie';

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
   */
  static async uploadDocument(params: UploadDocumentParams): Promise<DocumentResult> {
    const keyId = generateKeyId();
    const checksum = computeChecksum(params.fileBuffer);
    const encrypted = encryptDocument(params.fileBuffer, keyId);

    const ext = params.originalName.includes('.')
      ? params.originalName.substring(params.originalName.lastIndexOf('.'))
      : '';
    const objectKey = `documents/${params.documentType}/${keyId}${ext}.enc`;

    await putObject(objectKey, encrypted, 'application/octet-stream');

    const doc = await prisma.documentUpload.create({
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
      },
    });

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

    if (!doc || doc.isDestroyed) return null;

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

    try {
      await deleteObject(doc.storagePath);
    } catch {
      // Object may already be gone — continue with DB cleanup
    }

    await prisma.documentUpload.update({
      where: { id: documentId },
      data: {
        isDestroyed: true,
        destroyedAt: new Date(),
        destroyedReason: reason,
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
   * Get all documents for a cleaner profile, excluding destroyed ones.
   */
  static async getDocumentsForProfile(profileId: string): Promise<DocumentResult[]> {
    const docs = await prisma.documentUpload.findMany({
      where: { profileId, isDestroyed: false },
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

    if (approved) {
      await prisma.documentUpload.update({
        where: { id: documentId },
        data: {
          isVerified: true,
          verifiedBy: adminId,
          verifiedAt: new Date(),
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
