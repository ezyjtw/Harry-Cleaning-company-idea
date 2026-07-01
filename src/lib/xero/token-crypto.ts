import { decryptDocument, encryptDocument, generateKeyId } from '@/lib/utils/document-encryption';

// A13-Xero: encrypt OAuth tokens at rest. Reuses the platform's AES-256-GCM
// document-encryption (keyed off DOCUMENT_ENCRYPTION_KEY + a per-connection keyId)
// so plaintext access/refresh tokens are never stored. Stored as base64 strings.

export { generateKeyId };

export function encryptToken(plaintext: string, keyId: string): string {
  return encryptDocument(Buffer.from(plaintext, 'utf8'), keyId).toString('base64');
}

export function decryptToken(encryptedBase64: string, keyId: string): string {
  return decryptDocument(Buffer.from(encryptedBase64, 'base64'), keyId).toString('utf8');
}
