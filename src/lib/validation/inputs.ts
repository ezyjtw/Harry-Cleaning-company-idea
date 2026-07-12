// Numeric / formatted input validation (James, from live testing — malformed
// numbers were accepted, e.g. impossibly long values). Server-side is the law;
// client hints are courtesy. Pure functions + a few zod schemas, shared by
// every input-bearing route the sweep touches.

import { z } from 'zod';

// ─── Phone ───────────────────────────────────────────────────────────────────
// UK-shaped or E.164. Strip spaces/dashes/parens, then require: optional +,
// digits only, 7–15 total digits (E.164 max is 15). UK mobiles/landlines fit.
export function normalisePhone(raw: string): string {
  return raw.replace(/[\s()\-.]/g, '');
}
export function isValidPhone(raw: string): boolean {
  const p = normalisePhone(raw.trim());
  if (!/^\+?\d+$/.test(p)) return false;
  const digits = p.replace(/^\+/, '');
  return digits.length >= 7 && digits.length <= 15;
}
export const phoneSchema = z
  .string()
  .trim()
  .refine(isValidPhone, 'Enter a valid phone number (7–15 digits, UK or international).');

// ─── UK postcode ─────────────────────────────────────────────────────────────
const UK_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}|GIR\s?0AA)$/i;
export function isValidUkPostcode(raw: string): boolean {
  return UK_POSTCODE_RE.test(raw.trim());
}
export const postcodeSchema = z
  .string()
  .trim()
  .refine(isValidUkPostcode, 'Enter a valid UK postcode.');

// ─── Money / rates ───────────────────────────────────────────────────────────
// Bounds (James to confirm at the gate). Hourly: platform floor is £14 (kept in
// pricing.service); ceiling £200/hr — anything higher is a fat-finger. Fixed
// prices (EoT / Airbnb): £0–£2000. All must be finite, non-negative, ≤2 dp.
export const MAX_HOURLY_RATE = 200;
export const MAX_FIXED_PRICE = 2000;

export function isSaneMoney(n: unknown, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max && Math.round(n * 100) === n * 100;
}
/** A finite rate within [0, MAX_HOURLY_RATE]; the £14 floor stays in pricing.service. */
export function isSaneHourlyRate(n: unknown): n is number {
  return isSaneMoney(n, MAX_HOURLY_RATE);
}
export function isSaneFixedPrice(n: unknown): n is number {
  return isSaneMoney(n, MAX_FIXED_PRICE);
}

// ─── Duration / hours ────────────────────────────────────────────────────────
export function isSaneDurationHours(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 12;
}
export function isSaneHoursPerWeek(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 80;
}

// ─── Dates (expiry) ──────────────────────────────────────────────────────────
// A real date, strictly in the future, no more than `maxYears` out (rejects
// year-3000 / 19999 garbage). Returns the parsed Date or null.
export function parseFutureDate(raw: string, maxYears = 10): Date | null {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  const now = Date.now();
  if (d.getTime() <= now) return null;
  const ceiling = new Date();
  ceiling.setFullYear(ceiling.getFullYear() + maxYears);
  if (d.getTime() > ceiling.getTime()) return null;
  return d;
}

// ─── Home Office share code ──────────────────────────────────────────────────
// Format is 9 alphanumeric characters, conventionally grouped XXX-XXX-XXX.
// Accept with or without dashes; normalise to the dashed form.
export function isValidShareCode(raw: string): boolean {
  const c = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  return /^[A-Z0-9]{9}$/.test(c);
}
export function normaliseShareCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(/[\s-]/g, '');
  return `${c.slice(0, 3)}-${c.slice(3, 6)}-${c.slice(6, 9)}`;
}
