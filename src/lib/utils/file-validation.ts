const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
  // WebP also has "WEBP" at offset 8 — checked separately below
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
];

const ALLOWED_EVIDENCE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export function validateFileType(
  buffer: Buffer,
  claimedMime: string
): { valid: boolean; detectedMime: string | null; error?: string } {
  if (!ALLOWED_EVIDENCE_MIMES.has(claimedMime)) {
    return { valid: false, detectedMime: null, error: 'File type not allowed.' };
  }

  // SVG masquerading check: if file starts with `<` or BOM + `<`, reject
  if (buffer.length > 0) {
    const first = buffer[0];
    // UTF-8 BOM: EF BB BF, then `<` (0x3C)
    if (first === 0x3c || (first === 0xef && buffer.length > 3 && buffer[3] === 0x3c)) {
      return { valid: false, detectedMime: null, error: 'SVG/XML files are not allowed.' };
    }
  }

  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (matches) {
      // WebP needs secondary check at offset 8 for "WEBP"
      if (sig.mime === 'image/webp') {
        if (
          buffer.length < 12 ||
          buffer[8] !== 0x57 || // W
          buffer[9] !== 0x45 || // E
          buffer[10] !== 0x42 || // B
          buffer[11] !== 0x50 // P
        ) {
          continue;
        }
      }

      if (sig.mime !== claimedMime) {
        return {
          valid: false,
          detectedMime: sig.mime,
          error: `File content (${sig.mime}) does not match claimed type (${claimedMime}).`,
        };
      }
      return { valid: true, detectedMime: sig.mime };
    }
  }

  return { valid: false, detectedMime: null, error: 'Unable to verify file type from content.' };
}

export const MAX_EVIDENCE_SIZE = 10 * 1024 * 1024; // 10 MB
