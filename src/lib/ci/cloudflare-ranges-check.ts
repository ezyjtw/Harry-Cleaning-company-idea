// B7.14 (James-ruled, monthly rather than yearly): compare the committed
// Cloudflare edge ranges with the published lists. Pure so the script and
// its test share one comparison; the script fetches, this file decides.
import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from '../http/cloudflare-ranges';

export const CLOUDFLARE_IPS_V4_URL = 'https://www.cloudflare.com/ips-v4';
export const CLOUDFLARE_IPS_V6_URL = 'https://www.cloudflare.com/ips-v6';

/** One CIDR per line, blank lines and whitespace ignored. */
export function parsePublishedList(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export interface RangeDifference {
  family: 'v4' | 'v6';
  missingLocally: string[];
  extraLocally: string[];
}

/** Differences between the published lists and the committed constants. */
export function rangeDifferences(
  publishedV4: string[],
  publishedV6: string[],
  localV4: readonly string[] = CLOUDFLARE_IPV4_RANGES,
  localV6: readonly string[] = CLOUDFLARE_IPV6_RANGES
): RangeDifference[] {
  const diff = (
    family: 'v4' | 'v6',
    published: string[],
    local: readonly string[]
  ): RangeDifference | null => {
    const p = new Set(published);
    const l = new Set(local);
    const missingLocally = Array.from(p)
      .filter((r) => !l.has(r))
      .sort();
    const extraLocally = Array.from(l)
      .filter((r) => !p.has(r))
      .sort();
    return missingLocally.length || extraLocally.length
      ? { family, missingLocally, extraLocally }
      : null;
  };
  return [diff('v4', publishedV4, localV4), diff('v6', publishedV6, localV6)].filter(
    (d): d is RangeDifference => d !== null
  );
}

export function formatDifferences(diffs: RangeDifference[]): string {
  return diffs
    .map(
      (d) =>
        `${d.family}: published but not committed [${d.missingLocally.join(', ')}]; committed but no longer published [${d.extraLocally.join(', ')}]`
    )
    .join('\n');
}
