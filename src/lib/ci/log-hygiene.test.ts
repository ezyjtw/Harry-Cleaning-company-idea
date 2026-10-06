import { describe, expect, it } from 'vitest';

import { HYGIENE_ROOTS, findViolations, listSourceFiles, violationsInSource } from './log-hygiene';

describe('log hygiene grep (RENA-066)', () => {
  it('flags payloads, recipients, emails and phones in arguments', () => {
    const src = [
      "console.log('[JobProcessor] Sending email:', payload);",
      'console.log(`[Email] Sent to: ${to} — ${subject}`);',
      "console.error('[x] failed', user.email);",
      'console.log(',
      '  `[Lead] phone=${phone}`',
      ');',
      "console.log('[JobProcessor] SMS sent to:', payload.to);",
    ].join('\n');
    expect(violationsInSource(src).map((v) => v.line)).toEqual([1, 2, 3, 4, 7]);
  });
  it('ignores words inside the message text and safe arguments', () => {
    const src = [
      "console.log('[RegularOffer] review email carries the offer');",
      'console.log(`[Cascade] attempted for ${bookingId}: ${count} of ${total}`);',
      "console.error('[x] failed for booking', bookingId, err.code);",
    ].join('\n');
    expect(violationsInSource(src)).toEqual([]);
  });
  it('the repository is clean', () => {
    const files = HYGIENE_ROOTS.flatMap((r) => listSourceFiles(r));
    expect(files.length).toBeGreaterThan(100);
    expect(findViolations(files)).toEqual([]);
  });
});
