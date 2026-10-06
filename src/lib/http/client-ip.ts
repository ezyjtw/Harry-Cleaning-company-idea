// RENA-002 (B1a, James-ruled): the ONE client IP chooser. Pure and Edge-safe
// (no Node modules, no timers) so the middleware, the route limiters and the
// audit writers all share it. Replaces the two duplicated choosers and the
// twelve raw x-forwarded-for reads.
//
// Topology (James, from the record): renacleaning.co.uk is proxied through
// Cloudflare and TRUSTED_PROXY=cloudflare has been set in Railway since the
// July remediation gate. Railway's edge appends the connecting peer to
// x-forwarded-for, so the RIGHTMOST entry is the peer that reached Railway:
// a Cloudflare edge address for traffic through the proxy, or the client
// itself for a request sent straight to the .up.railway.app origin.
//
// Modes:
//   cloudflare  cf-connecting-ip is trusted only when that rightmost peer is
//               inside Cloudflare's published ranges; otherwise the rightmost
//               x-forwarded-for entry is used, so a direct-to-origin request
//               cannot forge its bucket by sending cf-connecting-ip.
//   railway     rightmost x-forwarded-for, then x-real-ip.
//   unset       the same as railway: cf-connecting-ip is NEVER honoured
//               without proof (the earlier "best effort" default trusted it
//               first, which any client can send).
import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from './cloudflare-ranges';

export type ProxyMode = 'cloudflare' | 'railway' | undefined;

type HeaderReader = { get(name: string): string | null };

function clean(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  return v ? v : undefined;
}

/** The rightmost non-empty x-forwarded-for entry: the peer the trusted edge saw. */
export function rightmostForwardedFor(headers: HeaderReader): string | undefined {
  const forwarded = headers.get('x-forwarded-for');
  if (!forwarded) return undefined;
  const parts = forwarded
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : undefined;
}

function parseIpv4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  let out = 0;
  for (let i = 1; i <= 4; i += 1) {
    const octet = Number(m[i]);
    if (octet > 255) return null;
    out = out * 256 + octet;
  }
  return out;
}

function parseIpv6(ip: string): bigint | null {
  // Strip a zone id and brackets; reject embedded IPv4 forms beyond the
  // mapped-v4 case, which Cloudflare's ranges never use.
  const raw = ip.replace(/^\[|\]$/g, '').split('%')[0];
  if (!/^[0-9a-fA-F:]+$/.test(raw) || raw.split('::').length > 2) return null;
  const [head, tail] = raw.split('::');
  const headParts = head ? head.split(':') : [];
  const tailParts = tail !== undefined ? (tail ? tail.split(':') : []) : [];
  if (raw.includes('::')) {
    if (headParts.length + tailParts.length > 7) return null;
  } else if (headParts.length !== 8) {
    return null;
  }
  const missing = raw.includes('::') ? 8 - headParts.length - tailParts.length : 0;
  const groups = [...headParts, ...new Array<string>(missing).fill('0'), ...tailParts];
  let out = BigInt(0);
  for (const g of groups) {
    if (g.length === 0 || g.length > 4) return null;
    out = (out << BigInt(16)) + BigInt(parseInt(g, 16));
  }
  return out;
}

function inCidrV4(ip: number, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const baseNum = parseIpv4(base);
  const bits = Number(bitsRaw);
  if (baseNum === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) >>> 0 === (baseNum & mask) >>> 0;
}

function inCidrV6(ip: bigint, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const baseNum = parseIpv6(base);
  const bits = Number(bitsRaw);
  if (baseNum === null || !Number.isInteger(bits) || bits < 0 || bits > 128) return false;
  const shift = BigInt(128 - bits);
  return ip >> shift === baseNum >> shift;
}

/** True when the address sits inside Cloudflare's published edge ranges. */
export function isCloudflareAddress(ip: string | undefined): boolean {
  if (!ip) return false;
  const v4 = parseIpv4(ip);
  if (v4 !== null) return CLOUDFLARE_IPV4_RANGES.some((cidr) => inCidrV4(v4, cidr));
  const v6 = parseIpv6(ip);
  if (v6 !== null) return CLOUDFLARE_IPV6_RANGES.some((cidr) => inCidrV6(v6, cidr));
  return false;
}

/**
 * Resolve the client address from request headers, or undefined when no
 * usable header is present. `mode` defaults to TRUSTED_PROXY.
 */
export function resolveClientIp(
  headers: HeaderReader,
  mode: ProxyMode = process.env.TRUSTED_PROXY as ProxyMode
): string | undefined {
  const peer = rightmostForwardedFor(headers);
  const realIp = clean(headers.get('x-real-ip'));
  if (mode === 'cloudflare') {
    const cf = clean(headers.get('cf-connecting-ip'));
    if (cf && isCloudflareAddress(peer)) return cf;
  }
  return peer || realIp;
}

/** The same resolution with a stable fallback key for rate-limit buckets. */
export function clientIpOrUnknown(headers: HeaderReader, mode?: ProxyMode): string {
  return resolveClientIp(headers, mode) ?? 'unknown';
}
