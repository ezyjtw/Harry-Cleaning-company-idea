import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  filterFields,
  isAllowedKey,
  log,
  pseudonym,
  reduceError,
  resetPseudonymKeyForTests,
} from './log';

// RENA-066 (D-l, B1b): the allowlisted logger.
describe('allowlist', () => {
  it('keeps ids, statuses, counts, durations, codes, provider and endpoint names', () => {
    for (const k of [
      'bookingId',
      'userIds',
      'status',
      'httpStatus',
      'processed',
      'retryCount',
      'durationMs',
      'code',
      'provider',
      'endpoint',
      'category',
      'action',
    ]) {
      expect(isAllowedKey(k)).toBe(true);
    }
  });
  it('drops personal and payload keys and lists only their names', () => {
    const { kept, dropped } = filterFields({
      bookingId: 'b1',
      email: 'someone@example.test',
      to: '+447700900123',
      body: 'secret text',
      address: '1 High Street',
      payload: { a: 1 },
    });
    expect(kept).toEqual({ bookingId: 'b1' });
    expect(dropped.sort()).toEqual(['address', 'body', 'email', 'payload', 'to']);
    expect(JSON.stringify({ kept, dropped })).not.toMatch(/someone|7700|secret|High Street/);
  });
  it('drops nested objects even on an allowlisted key, keeps primitive arrays capped', () => {
    const { kept, dropped } = filterFields({
      status: { nested: true },
      bookingIds: Array.from({ length: 30 }, (_, i) => `b${i}`),
    });
    expect(dropped).toEqual(['status']);
    expect((kept.bookingIds as string[]).length).toBe(20);
  });
  it('caps and redacts strings even on allowlisted keys', () => {
    const { kept } = filterFields({
      reason: `x${'y'.repeat(300)}`,
      code: 'mail someone@example.test now',
    });
    expect((kept.reason as string).length).toBeLessThanOrEqual(121);
    expect(kept.code).toBe('mail [email] now');
  });
  it('a *Ref key accepts only a pseudonym or null', () => {
    expect(filterFields({ recipientRef: 'someone@example.test' }).dropped).toEqual([
      'recipientRef',
    ]);
    expect(filterFields({ recipientRef: null }).kept).toEqual({ recipientRef: null });
    expect(filterFields({ recipientRef: 'p:0123456789abcdef' }).kept).toEqual({
      recipientRef: 'p:0123456789abcdef',
    });
  });
});

describe('reduceError', () => {
  it('keeps name, code, provider, httpStatus and providerRequestId; message redacted; no stack or raw', () => {
    const stripeLike = Object.assign(
      new Error('No such customer: cus_123 for someone@example.test'),
      {
        name: 'StripeInvalidRequestError',
        type: 'StripeInvalidRequestError',
        code: 'resource_missing',
        statusCode: 404,
        requestId: 'req_abc',
        raw: { payment_method: { billing_details: { email: 'someone@example.test' } } },
      }
    );
    const r = reduceError(stripeLike, 'stripe');
    expect(r).toEqual({
      name: 'StripeInvalidRequestError',
      code: 'resource_missing',
      provider: 'stripe',
      httpStatus: 404,
      providerRequestId: 'req_abc',
      message: 'No such customer: cus_123 for [email]',
    });
    expect(JSON.stringify(r)).not.toContain('billing_details');
  });
  it('handles Xero-style response errors and non-Error throws', () => {
    expect(
      reduceError(
        {
          response: { statusCode: 400, headers: { 'x-correlation-id': 'corr-1' } },
          message: 'bad',
        },
        'xero'
      )
    ).toMatchObject({
      httpStatus: 400,
      providerRequestId: 'corr-1',
      provider: 'xero',
    });
    expect(reduceError('plain text 07700 900123')).toEqual({
      name: 'Thrown',
      message: 'plain text [phone]',
    });
  });
});

describe('pseudonym', () => {
  afterEach(() => {
    delete process.env.LOG_HMAC_KEY;
    resetPseudonymKeyForTests();
  });
  it('is null without LOG_HMAC_KEY: no raw value, no plain hash', () => {
    delete process.env.LOG_HMAC_KEY;
    resetPseudonymKeyForTests();
    expect(pseudonym('someone@example.test')).toBeNull();
  });
  it('is keyed, stable, normalised and different under another key', () => {
    process.env.LOG_HMAC_KEY = 'k'.repeat(32);
    resetPseudonymKeyForTests();
    const a = pseudonym('Someone@Example.test ');
    expect(a).toMatch(/^p:[0-9a-f]{16}$/);
    expect(pseudonym('someone@example.test')).toBe(a);
    process.env.LOG_HMAC_KEY = 'z'.repeat(32);
    resetPseudonymKeyForTests();
    expect(pseudonym('someone@example.test')).not.toBe(a);
  });
  it('refuses a short key', () => {
    process.env.LOG_HMAC_KEY = 'short';
    resetPseudonymKeyForTests();
    expect(pseudonym('x@example.test')).toBeNull();
  });
});

describe('output', () => {
  let out: string[];
  beforeEach(() => {
    out = [];
    vi.spyOn(console, 'log').mockImplementation((l: string) => void out.push(l));
    vi.spyOn(console, 'warn').mockImplementation((l: string) => void out.push(l));
    vi.spyOn(console, 'error').mockImplementation((l: string) => void out.push(l));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  it('writes one JSON line in production with dropped names and the reduced error', () => {
    vi.stubEnv('NODE_ENV', 'production');
    log.error(
      'email',
      'failed',
      { userId: 'u1', to: 'someone@example.test' },
      new Error('boom for someone@example.test')
    );
    expect(out).toHaveLength(1);
    const rec = JSON.parse(out[0]);
    expect(rec).toMatchObject({
      level: 'error',
      scope: 'email',
      event: 'failed',
      userId: 'u1',
      dropped: ['to'],
    });
    expect(rec.error).toEqual({ name: 'Error', message: 'boom for [email]' });
    expect(out[0]).not.toContain('someone@');
  });
  it('drops debug in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    log.debug('x', 'y');
    expect(out).toHaveLength(0);
  });
});
