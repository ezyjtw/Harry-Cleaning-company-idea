import { describe, expect, it } from 'vitest';

import {
  clientIpOrUnknown,
  isCloudflareAddress,
  resolveClientIp,
  rightmostForwardedFor,
} from './client-ip';

// RENA-002 (B1a): the one chooser across the three modes with spoofed headers.
// Production topology: Cloudflare proxies the domain and TRUSTED_PROXY is
// cloudflare; Railway appends the connecting peer to x-forwarded-for.
function h(headers: Record<string, string>): { get(name: string): string | null } {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name) => lower[name.toLowerCase()] ?? null };
}

const CF_PEER = '172.70.42.11'; // inside 172.64.0.0/13
const CF_PEER_V6 = '2a06:98c0:3600::103'; // inside 2a06:98c0::/29
const DIRECT_PEER = '203.0.113.9';
const CLIENT = '198.51.100.7';
const SPOOF = '10.0.0.1';

describe('isCloudflareAddress', () => {
  it('matches the published IPv4 and IPv6 ranges and nothing else', () => {
    expect(isCloudflareAddress(CF_PEER)).toBe(true);
    expect(isCloudflareAddress('104.16.0.1')).toBe(true);
    expect(isCloudflareAddress('131.0.75.255')).toBe(true);
    expect(isCloudflareAddress(CF_PEER_V6)).toBe(true);
    expect(isCloudflareAddress('2606:4700::1111')).toBe(true);
    expect(isCloudflareAddress(DIRECT_PEER)).toBe(false);
    expect(isCloudflareAddress('131.0.76.1')).toBe(false);
    expect(isCloudflareAddress('2a06:98c8::1')).toBe(false);
    expect(isCloudflareAddress('not-an-ip')).toBe(false);
    expect(isCloudflareAddress(undefined)).toBe(false);
    expect(isCloudflareAddress('999.1.1.1')).toBe(false);
  });
});

describe('rightmostForwardedFor', () => {
  it('returns the last non-empty entry', () => {
    expect(rightmostForwardedFor(h({ 'x-forwarded-for': `${SPOOF}, ${CLIENT}, ${CF_PEER}` }))).toBe(
      CF_PEER
    );
    expect(rightmostForwardedFor(h({ 'x-forwarded-for': `${CLIENT}, ` }))).toBe(CLIENT);
    expect(rightmostForwardedFor(h({}))).toBeUndefined();
  });
});

describe('cloudflare mode', () => {
  it('trusts cf-connecting-ip when the peer that reached Railway is a Cloudflare edge', () => {
    const headers = h({ 'x-forwarded-for': `${CLIENT}, ${CF_PEER}`, 'cf-connecting-ip': CLIENT });
    expect(resolveClientIp(headers, 'cloudflare')).toBe(CLIENT);
  });
  it('trusts cf-connecting-ip behind an IPv6 Cloudflare edge', () => {
    const headers = h({
      'x-forwarded-for': `${CLIENT}, ${CF_PEER_V6}`,
      'cf-connecting-ip': CLIENT,
    });
    expect(resolveClientIp(headers, 'cloudflare')).toBe(CLIENT);
  });
  it('ignores a forged cf-connecting-ip from a direct-to-origin request and uses the peer', () => {
    const headers = h({ 'x-forwarded-for': `${DIRECT_PEER}`, 'cf-connecting-ip': SPOOF });
    expect(resolveClientIp(headers, 'cloudflare')).toBe(DIRECT_PEER);
  });
  it('ignores a forged cf-connecting-ip when the peer is a non-Cloudflare proxy chain', () => {
    const headers = h({ 'x-forwarded-for': `${SPOOF}, ${DIRECT_PEER}`, 'cf-connecting-ip': SPOOF });
    expect(resolveClientIp(headers, 'cloudflare')).toBe(DIRECT_PEER);
  });
  it('a spoofed leftmost x-forwarded-for never wins', () => {
    const headers = h({ 'x-forwarded-for': `${SPOOF}, ${DIRECT_PEER}` });
    expect(resolveClientIp(headers, 'cloudflare')).toBe(DIRECT_PEER);
  });
  it('falls back to x-real-ip with no x-forwarded-for, never to cf-connecting-ip', () => {
    expect(
      resolveClientIp(h({ 'x-real-ip': DIRECT_PEER, 'cf-connecting-ip': SPOOF }), 'cloudflare')
    ).toBe(DIRECT_PEER);
  });
});

describe('railway mode', () => {
  it('uses the rightmost x-forwarded-for and ignores cf-connecting-ip', () => {
    const headers = h({ 'x-forwarded-for': `${SPOOF}, ${CLIENT}`, 'cf-connecting-ip': SPOOF });
    expect(resolveClientIp(headers, 'railway')).toBe(CLIENT);
  });
  it('falls back to x-real-ip then undefined', () => {
    expect(resolveClientIp(h({ 'x-real-ip': CLIENT }), 'railway')).toBe(CLIENT);
    expect(resolveClientIp(h({}), 'railway')).toBeUndefined();
    expect(clientIpOrUnknown(h({}), 'railway')).toBe('unknown');
  });
});

describe('unset mode', () => {
  it('never honours cf-connecting-ip without proof (the retracted best-effort default)', () => {
    const headers = h({ 'x-forwarded-for': `${CLIENT}, ${CF_PEER}`, 'cf-connecting-ip': SPOOF });
    expect(resolveClientIp(headers, undefined)).toBe(CF_PEER);
    expect(resolveClientIp(h({ 'cf-connecting-ip': SPOOF }), undefined)).toBeUndefined();
  });
});
