import { promises as fs } from 'fs';
import path from 'path';

import { prisma } from '@/lib/db/prisma';
import {
  encryptDocument,
  decryptDocument,
  computeChecksum,
  generateKeyId,
  secureWipe,
} from '@/lib/utils/document-encryption';

import { AuditService } from './audit.service';

const UPLOAD_DIR = process.env.DOCUMENT_STORAGE_PATH || './uploads/documents';

export type DocumentType = 'dbs_certificate' | 'right_to_work' | 'photo_id' | 'insurance';

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
   * Ensures the upload directory exists.
   */
  private static async ensureUploadDir(): Promise<void> {
    const dir = path.resolve(UPLOAD_DIR);
    await fs.mkdir(dir, { recursive: true });
  }

  /**
   * Uploads and encrypts a document, storing it securely.
   */
  static async uploadDocument(params: UploadDocumentParams): Promise<DocumentResult> {
    await this.ensureUploadDir();

    const keyId = generateKeyId();
    const checksum = computeChecksum(params.fileBuffer);
    const encrypted = encryptDocument(params.fileBuffer, keyId);

    // Generate secure storage path
    const ext = path.extname(params.originalName);
    const storageName = `${keyId}${ext}.enc`;
    const storagePath = path.join(UPLOAD_DIR, params.documentType, storageName);

    // Ensure subdirectory exists
    await fs.mkdir(path.dirname(path.resolve(storagePath)), { recursive: true });

    // Write encrypted file
    await fs.writeFile(path.resolve(storagePath), encrypted);

    // Create database record
    const doc = await prisma.documentUpload.create({
      data: {
        userId: params.userId,
        profileId: params.profileId,
        documentType: params.documentType,
        originalName: params.originalName,
        storagePath,
        mimeType: params.mimeType,
        fileSize: params.fileBuffer.length,
        encryptionKeyId: keyId,
        checksum,
        expiresAt: params.expiresAt,
        metadata: params.metadata as Record<string, string> | undefined,
      },
    });

    // Audit log
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
   * Retrieves and decrypts a document (admin only).
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

    const encrypted = await fs.readFile(path.resolve(doc.storagePath));
    const decrypted = decryptDocument(encrypted, doc.encryptionKeyId);

    // Verify integrity
    const currentChecksum = computeChecksum(decrypted);
    if (currentChecksum !== doc.checksum) {
      throw new Error('Document integrity check failed — file may have been tampered with');
    }

    // Audit the access
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
   * Securely destroys a document — overwrites file with random data, then deletes.
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

    // Overwrite file with random data before deletion
    try {
      const filePath = path.resolve(doc.storagePath);
      const fileData = await fs.readFile(filePath);
      const wiped = secureWipe(fileData);
      await fs.writeFile(filePath, wiped);
      await fs.unlink(filePath);
    } catch {
      // File may already be gone — continue with DB cleanup
    }

    // Mark as destroyed in DB
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
    ipAddress?: string
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

      // Update the cleaner profile verification status
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
      },
      ipAddress,
    });
  }
}
