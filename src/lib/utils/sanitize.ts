const DANGEROUS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
];

export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';

  let sanitized = input;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Encode HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  return sanitized.trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];
    if (typeof value === 'string') {
      (sanitized as Record<string, unknown>)[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(
        value as Record<string, unknown>
      );
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) : item
      );
    }
  }

  return sanitized;
}

export function containsDangerousContent(input: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Sanitize free-text chat message content for storage.
 *
 * STRIP-based, NOT entity-encoding: we remove HTML tags and dangerous URI schemes
 * but leave ordinary text untouched, so legitimate messages keep their literal
 * characters and are NOT double-encoded on render (React JSX already escapes at
 * display time). Examples preserved verbatim: "a & b", "<3", "count+=1", "x < y".
 * Only genuine markup is removed: "<script>…", "<img onerror=…>", "javascript:".
 *
 * (Whole-tag stripping deliberately avoids the `on\w+=` event-handler regex used
 * by the stopgap, which false-positives on text like "personx=1".)
 */
export function sanitizeMessageContent(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/\0/g, '') // null bytes
    .replace(/<\/?[a-zA-Z][^>]*>/g, '') // strip HTML tags (script/img/etc.)
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/data:text\/html/gi, '')
    .trim();
}

export function sanitizeForSql(input: string): string {
  // Basic SQL injection prevention (Prisma handles this, but defense in depth)
  return input.replace(/['";\\]/g, '');
}
