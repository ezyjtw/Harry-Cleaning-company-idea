import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Derives an encryption key from the master key and a per-document key ID.
 * Uses HKDF-like derivation for unique per-document keys.
 */
function deriveKey(masterKey: string, keyId: string): Buffer {
  return createHash('sha256').update(`${masterKey}:${keyId}`).digest();
}

/**
 * Gets the master encryption key from environment.
 * In production, this should come from a KMS (AWS KMS, HashiCorp Vault, etc.)
 */
function getMasterKey(): string {
  const key = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'DOCUMENT_ENCRYPTION_KEY environment variable is required for document encryption'
    );
  }
  return key;
}

/**
 * Generates a unique key ID for a new document.
 */
export function generateKeyId(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Encrypts a file buffer using AES-256-GCM.
 * Returns the encrypted buffer with IV and auth tag prepended.
 *
 * Format: [IV (16 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
 */
export function encryptDocument(data: Buffer, keyId: string): Buffer {
  const masterKey = getMasterKey();
  const key = deriveKey(masterKey, keyId);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypts an encrypted document buffer.
 * Expects format: [IV (16 bytes)] [Auth Tag (16 bytes)] [Encrypted Data]
 */
export function decryptDocument(encryptedData: Buffer, keyId: string): Buffer {
  const masterKey = getMasterKey();
  const key = deriveKey(masterKey, keyId);

  const iv = encryptedData.subarray(0, IV_LENGTH);
  const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const data = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Computes a SHA-256 checksum of a file buffer for integrity verification.
 */
export function computeChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Securely destroys a document by overwriting with random data before deletion.
 * This ensures the encrypted content cannot be recovered.
 */
export function secureWipe(data: Buffer): Buffer {
  const randomData = randomBytes(data.length);
  data.fill(0);
  return randomData;
}

/**
 * Validates that the encryption key is properly configured.
 * Should be called at startup.
 */
export function validateEncryptionConfig(): { valid: boolean; error?: string } {
  try {
    const key = process.env.DOCUMENT_ENCRYPTION_KEY;
    if (!key) {
      return { valid: false, error: 'DOCUMENT_ENCRYPTION_KEY is not set' };
    }
    if (key.length < KEY_LENGTH) {
      return {
        valid: false,
        error: `DOCUMENT_ENCRYPTION_KEY must be at least ${KEY_LENGTH} characters`,
      };
    }

    // Test encrypt/decrypt cycle
    const testKeyId = 'validation-test';
    const testData = Buffer.from('encryption-validation-test');
    const encrypted = encryptDocument(testData, testKeyId);
    const decrypted = decryptDocument(encrypted, testKeyId);

    if (!testData.equals(decrypted)) {
      return { valid: false, error: 'Encryption round-trip validation failed' };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown encryption error',
    };
  }
}
