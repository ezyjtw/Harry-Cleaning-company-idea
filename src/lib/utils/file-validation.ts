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

export const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const DOCUMENT_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

/**
 * Detect a file's MIME purely from its magic bytes (no claimed-type input),
 * rejecting SVG/XML. Returns null if the content matches no allowed signature.
 */
export function detectMimeFromMagicBytes(buffer: Buffer): string | null {
  if (buffer.length > 0) {
    const first = buffer[0];
    // Reject SVG/XML (raw `<` or UTF-8 BOM + `<`)
    if (first === 0x3c || (first === 0xef && buffer.length > 3 && buffer[3] === 0x3c)) {
      return null;
    }
  }

  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    if (buffer.length < offset + sig.bytes.length) continue;
    const matches = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (!matches) continue;
    if (sig.mime === 'image/webp') {
      if (
        buffer.length < 12 ||
        buffer[8] !== 0x57 ||
        buffer[9] !== 0x45 ||
        buffer[10] !== 0x42 ||
        buffer[11] !== 0x50
      ) {
        continue;
      }
    }
    return sig.mime;
  }
  return null;
}

/**
 * Decode a base64 (or data-URL) upload and validate it by size and magic bytes.
 * Bounds the decoded size, rejects empty/oversized/mistyped/SVG content, and
 * returns the content-verified MIME (never a client-claimed one). Mirrors the
 * treatment the multipart evidence routes already apply.
 */
export function decodeBase64File(
  input: string,
  opts: { maxSize?: number; allowed?: Set<string>; typeLabel?: string } = {}
): { ok: true; buffer: Buffer; mime: string } | { ok: false; error: string } {
  const maxSize = opts.maxSize ?? MAX_EVIDENCE_SIZE;
  const allowed = opts.allowed ?? DOCUMENT_MIMES;
  // Human-readable guidance for the unsupported-type case (e.g. a HEIC photo
  // that didn't transcode). Never a raw enum/mime dump.
  const typeLabel = opts.typeLabel ?? 'a JPG, PNG, WebP, or PDF file';
  const maxMb = Math.round(maxSize / (1024 * 1024));

  // Strip a data-URL prefix if present, then bound the encoded length before
  // decoding so an oversized payload is never fully materialised in memory.
  const commaIdx = input.startsWith('data:') ? input.indexOf(',') : -1;
  const b64 = commaIdx >= 0 ? input.slice(commaIdx + 1) : input;

  if (b64.length > Math.ceil(maxSize * 1.4) + 128) {
    return { ok: false, error: `That file is too large. Please choose one under ${maxMb} MB.` };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(b64, 'base64');
  } catch {
    return { ok: false, error: 'Sorry, that file could not be read. Please try another.' };
  }

  if (buffer.length === 0) {
    return { ok: false, error: 'That file appears to be empty. Please choose another.' };
  }
  if (buffer.length > maxSize) {
    return { ok: false, error: `That file is too large. Please choose one under ${maxMb} MB.` };
  }

  const mime = detectMimeFromMagicBytes(buffer);
  if (!mime || !allowed.has(mime)) {
    return { ok: false, error: `Please upload ${typeLabel}.` };
  }

  return { ok: true, buffer, mime };
}
