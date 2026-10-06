// RENA-002 (B1a, James-ruled 2026-10-06): Cloudflare's published edge ranges,
// https://www.cloudflare.com/ips-v4 and /ips-v6. The chooser in client-ip.ts
// trusts cf-connecting-ip only when the immediate peer that reached Railway
// sits inside one of these ranges; a request sent straight to the
// .up.railway.app origin carries a non-Cloudflare peer and cannot forge its
// rate-limit bucket. Maintenance: the list is a code constant on purpose (no
// runtime fetch from the Edge); refresh it against the published page in a
// gate when Cloudflare announces a change. Snapshot: the published lists as
// known to the B1a session (its egress cannot reach cloudflare.com); James
// verifies it against the live page in the B1a gate before merge.
export const CLOUDFLARE_IPV4_RANGES: readonly string[] = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

export const CLOUDFLARE_IPV6_RANGES: readonly string[] = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];
