import { beforeEach, describe, expect, it, vi } from 'vitest';

// B7.6 (RENA-067, D-m): destroyDocument nulls the key reference in the same
// update that marks the row destroyed, and nothing decrypts afterwards.
const prisma = vi.hoisted(() => ({
  documentUpload: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  dataRetentionLog: { create: vi.fn().mockResolvedValue({}) },
}));
const r2 = vi.hoisted(() => ({ putObject: vi.fn(), getObject: vi.fn(), deleteObject: vi.fn() }));
const audit = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ prisma, default: prisma }));
vi.mock('@/lib/storage/r2-client', () => r2);
vi.mock('./audit.service', () => ({ AuditService: audit }));
vi.mock('@/lib/log', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { decryptDocument, encryptDocument } from '@/lib/utils/document-encryption';

import { DocumentStorageService } from './document-storage.service';

const ROW = {
  id: 'doc_1',
  userId: 'user_1',
  documentType: 'photo_id',
  storagePath: 'documents/photo_id/k1.enc',
  mimeType: 'image/png',
  originalName: 'id.png',
  checksum: 'x',
  encryptionKeyId: 'k1',
  isDestroyed: false,
  storageState: 'STORED',
};

describe('destroyDocument (RENA-067)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('DOCUMENT_ENCRYPTION_KEY', 'test-only-master-key-0123456789abcdef0123456789');
    prisma.documentUpload.update.mockResolvedValue({});
    audit.log.mockResolvedValue(undefined);
  });

  it('nulls encryptionKeyId in the same update that marks the row destroyed', async () => {
    prisma.documentUpload.findUnique.mockResolvedValue(ROW);
    r2.deleteObject.mockResolvedValue(undefined);
    await DocumentStorageService.destroyDocument('doc_1', 'retention_policy', 'SYSTEM');
    expect(prisma.documentUpload.update).toHaveBeenCalledTimes(1);
    const { data } = prisma.documentUpload.update.mock.calls[0][0];
    expect(data.isDestroyed).toBe(true);
    expect(data.encryptionKeyId).toBeNull();
    expect(data.storageState).toBe('DELETED');
  });

  it('nulls the key reference even when the object delete fails (the sweep retries the object)', async () => {
    prisma.documentUpload.findUnique.mockResolvedValue(ROW);
    r2.deleteObject.mockRejectedValue(new Error('r2 down'));
    await DocumentStorageService.destroyDocument('doc_1', 'retention_policy', 'SYSTEM');
    const { data } = prisma.documentUpload.update.mock.calls[0][0];
    expect(data.encryptionKeyId).toBeNull();
    expect(data.storageState).toBeUndefined();
  });

  it('getDocument answers null for a row without a key reference and never reads the object', async () => {
    prisma.documentUpload.findUnique.mockResolvedValue({
      ...ROW,
      isDestroyed: false,
      encryptionKeyId: null,
    });
    const out = await DocumentStorageService.getDocument('doc_1', 'admin_1');
    expect(out).toBeNull();
    expect(r2.getObject).not.toHaveBeenCalled();
  });

  it('ciphertext cannot be decrypted without the key reference it was written under', () => {
    const plain = Buffer.from('synthetic document bytes');
    const encrypted = encryptDocument(plain, 'k1');
    expect(decryptDocument(encrypted, 'k1').equals(plain)).toBe(true);
    expect(() => decryptDocument(encrypted, 'some-other-reference')).toThrow();
  });
});
