import { randomBytes, timingSafeEqual } from 'crypto';

import type { NextRequest } from 'next/server';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = 'x-csrf-token';
const CSRF_COOKIE = '__csrf';

export function generateCsrfToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

export function validateCsrfToken(request: NextRequest): boolean {
  const headerToken = request.headers.get(CSRF_HEADER);
  const cookieToken = request.cookies.get(CSRF_COOKIE)?.value;

  if (!headerToken || !cookieToken) {
    return false;
  }

  // Timing-safe comparison
  if (headerToken.length !== cookieToken.length) {
    return false;
  }

  const headerBuffer = Buffer.from(headerToken);
  const cookieBuffer = Buffer.from(cookieToken);

  return timingSafeEqual(headerBuffer, cookieBuffer);
}

export function getCsrfHeaders(token: string): Record<string, string> {
  return { [CSRF_HEADER]: token };
}
