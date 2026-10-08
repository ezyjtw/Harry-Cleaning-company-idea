import { describe, expect, it } from 'vitest';

import { decideGetApp, isGetAppId, platformFromUserAgent, storeUrlsFor } from './get-app';

const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari';
const APPLE = 'https://apps.apple.com/gb/app/rena-pro/id1234567890';
const PLAY = 'https://play.google.com/store/apps/details?id=uk.co.renacleaning.pro';

describe('get-app doors (B5, RENA-043)', () => {
  it('knows its two apps only', () => {
    expect(isGetAppId('pro')).toBe(true);
    expect(isGetAppId('customer')).toBe(true);
    expect(isGetAppId('Pro')).toBe(false);
    expect(isGetAppId('admin')).toBe(false);
  });

  it.each([
    [IOS_UA, 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'ios'],
    [ANDROID_UA, 'android'],
    [DESKTOP_UA, 'other'],
    ['', 'other'],
  ] as const)('platform of %s is %s', (ua, want) => {
    expect(platformFromUserAgent(ua)).toBe(want);
  });

  it('nothing configured: every platform gets the page (coming soon)', () => {
    const urls = storeUrlsFor('pro', {});
    expect(urls).toEqual({ ios: null, android: null });
    for (const p of ['ios', 'android', 'other'] as const) {
      expect(decideGetApp(p, urls)).toEqual({ kind: 'page', urls });
    }
  });

  it('a configured listing redirects only its own platform; a computer gets the page with links', () => {
    const urls = storeUrlsFor('pro', { PRO_STORE_URL_IOS: APPLE, PRO_STORE_URL_ANDROID: PLAY });
    expect(decideGetApp('ios', urls)).toEqual({ kind: 'redirect', url: APPLE });
    expect(decideGetApp('android', urls)).toEqual({ kind: 'redirect', url: PLAY });
    expect(decideGetApp('other', urls)).toEqual({ kind: 'page', urls });
    const iosOnly = storeUrlsFor('customer', { CUSTOMER_STORE_URL_IOS: APPLE });
    expect(decideGetApp('android', iosOnly)).toEqual({ kind: 'page', urls: iosOnly });
  });

  it('each app reads only its own variables', () => {
    expect(storeUrlsFor('customer', { PRO_STORE_URL_IOS: APPLE })).toEqual({
      ios: null,
      android: null,
    });
  });

  it.each([
    ['http, not https', 'http://apps.apple.com/x'],
    ['lookalike host', 'https://apps.apple.com.evil.example/x'],
    ['userinfo trick', 'https://apps.apple.com@evil.example/x'],
    ['wrong store for the platform', PLAY],
    ['a port', 'https://apps.apple.com:8443/x'],
    ['not a URL', 'apps.apple.com/x'],
  ])('an untrusted iOS value is ignored: %s', (_label, value) => {
    expect(storeUrlsFor('pro', { PRO_STORE_URL_IOS: value }).ios).toBeNull();
  });
});
