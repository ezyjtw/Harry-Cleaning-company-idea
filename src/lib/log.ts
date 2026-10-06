import { createHmac } from 'crypto';

import { redactText } from './redact';

// RENA-066, RENA-077 (D-l, B1b, James-ruled): the structured server logger.
//
//   Allowlist   Only keys that carry identifiers, statuses, counts, durations,
//               codes, or provider and endpoint names are written. Any other
//               key is dropped and only its NAME is listed under `dropped`,
//               never its value. Nested objects are dropped the same way;
//               arrays survive only for allowlisted keys and only of
//               primitives, capped in length.
//   Strings     Every string value is passed through the bounded redactor and
//               capped, even on an allowlisted key.
//   Errors      Reduced to name, code, provider, httpStatus and
//               providerRequestId; a retained message goes through the same
//               redactor. Stacks, bodies and provider payloads never travel.
//   Pseudonyms  log.pseudonym() is a keyed HMAC-SHA256 under LOG_HMAC_KEY, a
//               key used for nothing else. Only `*Ref` keys accept it, and only
//               in its own format. With no key set it returns null: nothing
//               identifying is written, never a raw value or a plain hash.
//   Output      One JSON line per event in production; a readable line in
//               development. This module is the only place in src/lib and
//               src/app/api allowed to call console (eslint no-console).

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Primitive = string | number | boolean | null;
export type LogFields = Record<string, unknown>;

const STRING_MAX = 120;
const ARRAY_MAX = 20;
const PSEUDONYM_RE = /^p:[0-9a-f]{16}$/;

// Exact keys that are safe by nature (statuses, counts, durations, codes,
// provider and endpoint names, routing words).
const EXACT_KEYS = new Set([
  'id',
  'status',
  'httpStatus',
  'state',
  'phase',
  'outcome',
  'result',
  'count',
  'total',
  'processed',
  'attempted',
  'succeeded',
  'failed',
  'skipped',
  'remaining',
  'attempts',
  'maxAttempts',
  'durationMs',
  'elapsedMs',
  'ms',
  'ageSeconds',
  'code',
  'errorCode',
  'reason',
  'provider',
  'endpoint',
  'method',
  'route',
  'category',
  'type',
  'jobType',
  'action',
  'event',
  'stage',
  'surface',
  'role',
  'kind',
  'mode',
  'channel',
  'enabled',
  'configured',
  'ok',
  'retry',
  'amountPence',
  'currency',
  'version',
  'app',
  'shell',
  'platform',
  'pane',
  'phaseName',
]);

// Key families: identifiers (…Id, …Ids), counts (…Count), durations (…Ms).
const KEY_PATTERNS = [/Id$/, /Ids$/, /Count$/, /Ms$/];

export function isAllowedKey(key: string): boolean {
  return EXACT_KEYS.has(key) || KEY_PATTERNS.some((p) => p.test(key)) || /Ref$/.test(key);
}

function cleanPrimitive(value: unknown): Primitive | undefined {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return redactText(value, STRING_MAX);
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

/** Filter fields through the allowlist; returns the kept fields and dropped key names. */
export function filterFields(fields: LogFields | undefined): {
  kept: Record<string, Primitive | Primitive[]>;
  dropped: string[];
} {
  const kept: Record<string, Primitive | Primitive[]> = {};
  const dropped: string[] = [];
  if (!fields) return { kept, dropped };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!isAllowedKey(key)) {
      dropped.push(key);
      continue;
    }
    if (/Ref$/.test(key)) {
      // Only a pseudonym in its own format, or null (no key configured).
      if (value === null || (typeof value === 'string' && PSEUDONYM_RE.test(value))) {
        kept[key] = value as Primitive;
      } else {
        dropped.push(key);
      }
      continue;
    }
    if (Array.isArray(value)) {
      const items = value.slice(0, ARRAY_MAX).map(cleanPrimitive);
      if (items.every((i) => i !== undefined)) {
        kept[key] = items as Primitive[];
      } else {
        dropped.push(key);
      }
      continue;
    }
    const prim = cleanPrimitive(value);
    if (prim === undefined) dropped.push(key);
    else kept[key] = prim;
  }
  return { kept, dropped };
}

export interface ReducedError {
  name: string;
  code?: string;
  provider?: string;
  httpStatus?: number;
  providerRequestId?: string;
  message?: string;
}

/**
 * Reduce any thrown value to its safe shape. Understands Stripe (type, code,
 * statusCode, requestId), Prisma (code), Xero and HTTP clients (statusCode,
 * response.statusCode, x-correlation-id) and plain Errors.
 */
export function reduceError(err: unknown, provider?: string): ReducedError {
  const e = (err ?? {}) as Record<string, unknown> & {
    response?: { statusCode?: number; status?: number; headers?: Record<string, unknown> };
    raw?: { requestId?: string };
  };
  const name =
    typeof e.name === 'string'
      ? e.name
      : err instanceof Error
        ? err.constructor.name
        : typeof err === 'string'
          ? 'Thrown'
          : 'Unknown';
  const out: ReducedError = { name: redactText(name, 60) };
  const code = e.code ?? e.type;
  if (typeof code === 'string' || typeof code === 'number') out.code = redactText(String(code), 60);
  if (provider) out.provider = provider;
  const status = e.statusCode ?? e.status ?? e.response?.statusCode ?? e.response?.status;
  if (typeof status === 'number') out.httpStatus = status;
  const headers = e.response?.headers ?? {};
  const reqId =
    e.requestId ??
    e.raw?.requestId ??
    headers['x-correlation-id'] ??
    headers['request-id'] ??
    headers['x-request-id'];
  if (typeof reqId === 'string') out.providerRequestId = redactText(reqId, 80);
  const message = err instanceof Error ? err.message : typeof err === 'string' ? err : e.message;
  if (message !== undefined && message !== null && message !== '') {
    out.message = redactText(message);
  }
  return out;
}

let hmacKeyCache: string | null | undefined;
function hmacKey(): string | null {
  if (hmacKeyCache === undefined) {
    const k = process.env.LOG_HMAC_KEY;
    hmacKeyCache = k && k.length >= 16 ? k : null;
  }
  return hmacKeyCache;
}

/** Test hook: forget the cached key so a test can change LOG_HMAC_KEY. */
export function resetPseudonymKeyForTests(): void {
  hmacKeyCache = undefined;
}

/**
 * Keyed pseudonym for correlation where an internal id cannot serve (an
 * address that has no account). Normalised (trim, lower-case) so the same
 * address always maps to the same value. Null when LOG_HMAC_KEY is absent.
 */
export function pseudonym(value: string | null | undefined): string | null {
  const key = hmacKey();
  if (!key || !value) return null;
  const digest = createHmac('sha256', key).update(value.trim().toLowerCase()).digest('hex');
  return `p:${digest.slice(0, 16)}`;
}

function emit(
  level: LogLevel,
  scope: string,
  event: string,
  fields?: LogFields,
  err?: unknown
): void {
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;
  const { kept, dropped } = filterFields(fields);
  const record: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    scope: redactText(scope, 40),
    event: redactText(event, 80),
    ...kept,
  };
  if (err !== undefined) record.error = reduceError(err, fields?.provider as string | undefined);
  if (dropped.length) record.dropped = dropped;

  const line =
    process.env.NODE_ENV === 'production'
      ? JSON.stringify(record)
      : `[${record.scope}] ${record.event} ${JSON.stringify({ ...kept, ...(record.error ? { error: record.error } : {}), ...(dropped.length ? { dropped } : {}) })}`;
  // The one sanctioned console sink in src/lib and src/app/api.
  /* eslint-disable no-console */
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
  /* eslint-enable no-console */
}

export const log = {
  debug: (scope: string, event: string, fields?: LogFields) => emit('debug', scope, event, fields),
  info: (scope: string, event: string, fields?: LogFields) => emit('info', scope, event, fields),
  warn: (scope: string, event: string, fields?: LogFields, err?: unknown) =>
    emit('warn', scope, event, fields, err),
  error: (scope: string, event: string, fields?: LogFields, err?: unknown) =>
    emit('error', scope, event, fields, err),
  pseudonym,
};

export default log;
