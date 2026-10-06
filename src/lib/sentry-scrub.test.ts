import { describe, expect, it } from 'vitest';

import {
  scrubBreadcrumb,
  scrubEvent,
  sentryScrubOptions,
  withoutConsoleIntegration,
} from './sentry-scrub';

describe('Sentry scrubber (RENA-066)', () => {
  it('strips headers, cookies, query strings, bodies; user to id; extra and unsafe contexts dropped; text redacted', () => {
    const event = {
      request: {
        method: 'POST',
        url: 'https://www.renacleaning.co.uk/api/bookings?email=someone@example.test',
        headers: { authorization: 'Bearer t', cookie: 'sid=1' },
        cookies: { sid: '1' },
        query_string: 'email=someone@example.test',
        data: { address: '1 High St' },
      },
      user: { id: 'u1', email: 'someone@example.test', ip_address: '1.2.3.4' },
      extra: { payload: { to: 'someone@example.test' } },
      contexts: { os: { name: 'iOS' }, booking: { address: '1 High St' } },
      message: 'failed for someone@example.test',
      exception: { values: [{ type: 'Error', value: 'card 4242424242424242 for 07700 900123' }] },
      breadcrumbs: [
        { category: 'console', message: 'to someone@example.test' },
        {
          category: 'fetch',
          data: { url: '/api/x?token=abc', method: 'GET', status_code: 200, body: 'b' },
        },
      ],
    };
    const out = scrubEvent(event);
    expect(out.request).toEqual({
      method: 'POST',
      url: 'https://www.renacleaning.co.uk/api/bookings',
    });
    expect(out.user).toEqual({ id: 'u1' });
    expect(out.extra).toBeUndefined();
    expect(out.contexts).toEqual({ os: { name: 'iOS' } });
    expect(out.message).toBe('failed for [email]');
    expect(out.exception.values[0].value).toBe('card [number] for [phone]');
    expect(out.breadcrumbs).toEqual([
      { category: 'fetch', data: { url: '/api/x', method: 'GET', status_code: 200 } },
    ]);
    expect(JSON.stringify(out)).not.toMatch(/someone@|High St|Bearer|sid=|token=abc/);
  });
  it('drops console breadcrumbs at capture time and keeps sendDefaultPii off', () => {
    expect(scrubBreadcrumb({ category: 'console', message: 'x' })).toBeNull();
    expect(sentryScrubOptions.sendDefaultPii).toBe(false);
    expect(sentryScrubOptions.beforeBreadcrumb({ category: 'console' })).toBeNull();
  });
  it('removes the console integration from the defaults', () => {
    expect(
      withoutConsoleIntegration([{ name: 'Console' }, { name: 'Http' }, { name: 'CaptureConsole' }])
    ).toEqual([{ name: 'Http' }]);
  });
});
