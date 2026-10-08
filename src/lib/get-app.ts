// B5 (RENA-043): the /get-app doors. The apps' "get the other app" fallback
// points at these routes, so a listing going live (or changing) is a server
// setting, never an OTA. Pure, so the decision table is unit-tested.
//
// A store URL is honoured only when it parses to https on the exact store host
// (a trust decision on a URL is made on a parsed URL with an exact host
// match): a misconfigured value never turns these doors into an open redirect.

export type GetAppId = 'pro' | 'customer';
export type Platform = 'ios' | 'android' | 'other';

export interface StoreUrls {
  ios: string | null;
  android: string | null;
}

const STORE_HOST: Record<'ios' | 'android', string> = {
  ios: 'apps.apple.com',
  android: 'play.google.com',
};

export function isGetAppId(v: string): v is GetAppId {
  return v === 'pro' || v === 'customer';
}

export function platformFromUserAgent(ua: string | null | undefined): Platform {
  const s = ua ?? '';
  if (/\b(iPhone|iPad|iPod)\b/.test(s)) return 'ios';
  if (/\bAndroid\b/.test(s)) return 'android';
  return 'other';
}

function validStoreUrl(raw: string | undefined, platform: 'ios' | 'android'): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  if (u.hostname.toLowerCase() !== STORE_HOST[platform]) return null;
  return u.toString();
}

export function storeUrlsFor(
  app: GetAppId,
  env: Record<string, string | undefined> = process.env
): StoreUrls {
  const prefix = app === 'pro' ? 'PRO' : 'CUSTOMER';
  return {
    ios: validStoreUrl(env[`${prefix}_STORE_URL_IOS`], 'ios'),
    android: validStoreUrl(env[`${prefix}_STORE_URL_ANDROID`], 'android'),
  };
}

export type GetAppDecision = { kind: 'redirect'; url: string } | { kind: 'page'; urls: StoreUrls };

/** Redirect a phone to its own platform's live listing; everyone else gets the page. */
export function decideGetApp(platform: Platform, urls: StoreUrls): GetAppDecision {
  if (platform === 'ios' && urls.ios) return { kind: 'redirect', url: urls.ios };
  if (platform === 'android' && urls.android) return { kind: 'redirect', url: urls.android };
  return { kind: 'page', urls };
}
