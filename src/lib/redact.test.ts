import { describe, expect, it } from 'vitest';

import { redactText } from './redact';

describe('redactText (RENA-066)', () => {
  it('scrubs emails, phones, postcodes, tokens, keys, client secrets and query strings', () => {
    const input =
      'to a.b+c@example.co.uk tel 07700 900123 or +44 7700 900123 at SW1A 1AA; Bearer abc.def.ghi; sk_live_ABCDEFGH12; whsec_abcdef123; pi_123_secret_456; https://x.test/p?token=1&e=2';
    const out = redactText(input, 1000);
    for (const leak of [
      'a.b+c@',
      '900123',
      'SW1A',
      'abc.def',
      'ABCDEFGH12',
      'whsec_abc',
      'secret_456',
      'token=1',
    ]) {
      expect(out).not.toContain(leak);
    }
    expect(out).toContain('https://x.test/p?[query]');
  });
  it('keeps only the first line and caps length', () => {
    expect(redactText('one\ntwo')).toBe('one');
    expect(redactText('x'.repeat(500)).length).toBe(201);
  });
  it('leaves ids and plain words alone', () => {
    expect(redactText('booking cmux3yl2r0000 status CONFIRMED')).toBe(
      'booking cmux3yl2r0000 status CONFIRMED'
    );
  });
});
