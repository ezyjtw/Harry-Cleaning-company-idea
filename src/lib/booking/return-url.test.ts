import { describe, expect, it } from 'vitest';

import { buildReturnUrl } from './return-url';

describe('buildReturnUrl (RENA-020)', () => {
  it('carries the guest token whenever one was minted', () => {
    expect(buildReturnUrl('https://www.renacleaning.co.uk', 'bk_1', 'tok-123')).toBe(
      'https://www.renacleaning.co.uk/en/booking-confirmation/bk_1?gt=tok-123'
    );
  });
  it('omits it for an account booking', () => {
    expect(buildReturnUrl('https://www.renacleaning.co.uk', 'bk_1', null)).toBe(
      'https://www.renacleaning.co.uk/en/booking-confirmation/bk_1'
    );
    expect(buildReturnUrl('https://www.renacleaning.co.uk', 'bk_1', undefined)).toBe(
      'https://www.renacleaning.co.uk/en/booking-confirmation/bk_1'
    );
  });
  it('encodes the token and the id, and tolerates a trailing slash on the origin', () => {
    expect(buildReturnUrl('https://www.renacleaning.co.uk/', 'a b', 'x&y=z')).toBe(
      'https://www.renacleaning.co.uk/en/booking-confirmation/a%20b?gt=x%26y%3Dz'
    );
  });
});
