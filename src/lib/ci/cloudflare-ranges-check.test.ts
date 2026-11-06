import { describe, expect, it } from 'vitest';

import { CLOUDFLARE_IPV4_RANGES, CLOUDFLARE_IPV6_RANGES } from '../http/cloudflare-ranges';

import { formatDifferences, parsePublishedList, rangeDifferences } from './cloudflare-ranges-check';

describe('Cloudflare range check (B7.14)', () => {
  it('parses the published one-per-line form, ignoring blanks and whitespace', () => {
    expect(parsePublishedList('173.245.48.0/20\n\n 103.21.244.0/22 \r\n')).toEqual([
      '173.245.48.0/20',
      '103.21.244.0/22',
    ]);
  });

  it('reports no difference when the published lists equal the committed constants', () => {
    expect(rangeDifferences([...CLOUDFLARE_IPV4_RANGES], [...CLOUDFLARE_IPV6_RANGES])).toEqual([]);
  });

  it('names a range Cloudflare added and a range it withdrew, per family', () => {
    const v4 = [...CLOUDFLARE_IPV4_RANGES.slice(1), '198.51.100.0/24'];
    const diffs = rangeDifferences(v4, [...CLOUDFLARE_IPV6_RANGES]);
    expect(diffs).toEqual([
      {
        family: 'v4',
        missingLocally: ['198.51.100.0/24'],
        extraLocally: [CLOUDFLARE_IPV4_RANGES[0]],
      },
    ]);
    expect(formatDifferences(diffs)).toContain('198.51.100.0/24');
    expect(formatDifferences(diffs)).toContain(CLOUDFLARE_IPV4_RANGES[0]);
  });

  it('is order-insensitive', () => {
    expect(
      rangeDifferences([...CLOUDFLARE_IPV4_RANGES].reverse(), [...CLOUDFLARE_IPV6_RANGES].reverse())
    ).toEqual([]);
  });
});
