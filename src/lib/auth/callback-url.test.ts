import { describe, expect, it } from 'vitest';

import { safeCallbackUrl } from './callback-url';

// RENA-020 (B2a): the shared sanitiser's acceptance table.
describe('safeCallbackUrl', () => {
  it.each([
    ['/account', '/account'],
    ['/book/abc?step=details&postcode=E4%209AA', '/book/abc?step=details&postcode=E4%209AA'],
    ['/pay/xyz', '/pay/xyz'],
    ['/en/account/bookings#upcoming', '/en/account/bookings#upcoming'],
    ['/', '/'],
    // Percent-encoded bytes stay encoded inside a same-origin path: harmless.
    ['/%0d%0aSet-Cookie:x', '/%0d%0aSet-Cookie:x'],
  ])('keeps the same-origin relative path %s', (raw, expected) => {
    expect(safeCallbackUrl(raw)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'account',
    'https://evil.example/account',
    'http://www.renacleaning.co.uk/account',
    '//evil.example',
    '//evil.example/account',
    '/\\evil.example',
    '\\\\evil.example',
    '/account\\..\\x',
    'javascript:alert(1)',
    '/account\r\nLocation: https://evil.example',
    '/account\u0000',
    `/${'a'.repeat(2050)}`,
  ])('refuses %j', (raw) => {
    expect(safeCallbackUrl(raw as string | null | undefined)).toBeNull();
  });
});
