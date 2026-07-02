import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

// ─── Password Hashing ──────────────────────────────────────────────────────

const SALT_LENGTH = 32;
const KEY_LENGTH = 64;
const ITERATIONS = 100000;
const DIGEST = 'sha512';

/**
 * Hashes a password using PBKDF2 (similar security to bcrypt).
 * Returns a string in format: salt:hash
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');

  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored hash.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');

  if (!salt || !hash) {
    return false;
  }

  const derivedHash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');

  const hashBuffer = Buffer.from(hash, 'hex');
  const derivedBuffer = Buffer.from(derivedHash, 'hex');

  if (hashBuffer.length !== derivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashBuffer, derivedBuffer);
}

// ─── Token Generation ───────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token.
 * @param length - Length of the token in bytes (default: 32, producing a 64-char hex string)
 */
export function generateToken(length = 32): string {
  return randomBytes(length).toString('hex');
}

// ─── HTML Sanitization ──────────────────────────────────────────────────────

/**
 * Strips potentially dangerous HTML content, keeping only safe text.
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .trim();
}

// ─── Rate Limiter ───────────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Simple in-memory rate limiter.
 * For production use, prefer Redis-backed rate limiting.
 */
export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(options: { windowMs?: number; maxRequests?: number } = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minute default
    this.maxRequests = options.maxRequests || 60; // 60 requests default

    // Periodically clean up stale entries
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), this.windowMs * 2);
    }
  }

  /**
   * Check if a key (e.g., IP address) has exceeded the rate limit.
   * Returns an object with limit info.
   */
  check(key: string): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + this.windowMs });
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetTime: now + this.windowMs,
      };
    }

    entry.count++;

    if (entry.count > this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset the rate limit for a specific key.
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove expired entries from the store.
   */
  private cleanup(): void {
    const now = Date.now();
    this.store.forEach((entry, key) => {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    });
  }
}

// ─── Session Management ──────────────────────────────────────────────────────

export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isSessionExpired(lastActivity: Date): boolean {
  return Date.now() - lastActivity.getTime() > SESSION_EXPIRY_MS;
}

// ─── Account Lockout ──────────────────────────────────────────────────────────

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function isAccountLocked(failedAttempts: number, lastFailedAt?: Date): boolean {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) return false;
  if (!lastFailedAt) return false;
  return Date.now() - lastFailedAt.getTime() < LOCKOUT_DURATION_MS;
}
