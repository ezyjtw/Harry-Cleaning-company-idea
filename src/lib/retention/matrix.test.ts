import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { stripRoomsText } from './jobs';
import { HOLDS, RETENTION_MATRIX, horizonCutoff, matrixRow } from './matrix';

// B7.3 (RENA-063): the matrix is the single source of truth; the privacy page
// is checked against it here, so a horizon cannot change on one side only.
const ROOT = join(__dirname, '..', '..', '..');
const privacy = readFileSync(join(ROOT, 'src/app/[locale]/privacy/page.tsx'), 'utf8').replace(
  /\s+/g,
  ' '
);

describe('retention matrix (B7.3)', () => {
  it('names the agreed horizons and anchors', () => {
    expect(matrixRow('accountData').horizonYears).toBe(6);
    expect(matrixRow('bookingRecords').horizonYears).toBe(6);
    expect(matrixRow('messages').horizonYears).toBe(2);
    expect(matrixRow('auditLogs').horizonYears).toBe(7);
    expect(matrixRow('notifications').horizonYears).toBe(2);
    expect(matrixRow('consentMetadata').horizonYears).toBe(2);
    expect(matrixRow('analytics').horizonYears).toBe(2);
    expect(matrixRow('messages').anchor).toContain('per thread');
  });

  it('carries the legal holds the design names', () => {
    expect(matrixRow('accountData').holds.map((h) => h.key)).toEqual([
      'open_dispute',
      'open_complaint',
      'unsettled_money',
      'tax_hold',
    ]);
    expect(matrixRow('bookingRecords').holds.map((h) => h.key)).toEqual([
      'open_dispute_or_complaint',
      'chargeback_window',
    ]);
    expect(matrixRow('messages').holds).toEqual([HOLDS.threadOpenDispute]);
    for (const cls of ['auditLogs', 'notifications', 'consentMetadata'] as const) {
      expect(matrixRow(cls).holds).toEqual([]);
    }
  });

  it('the horizon cutoff is whole years before now', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    expect(horizonCutoff('accountData', now).toISOString()).toBe('2020-11-06T12:00:00.000Z');
    expect(horizonCutoff('messages', now).toISOString()).toBe('2024-11-06T12:00:00.000Z');
    expect(horizonCutoff('auditLogs', now).toISOString()).toBe('2019-11-06T12:00:00.000Z');
  });

  it('the privacy page section 5 states every horizon as "up to N years" and names every class', () => {
    const labels: Record<string, string> = {
      accountData: 'Account data:',
      bookingRecords: 'Booking and payment records:',
      messages: 'Messages:',
      auditLogs: 'Audit logs:',
      notifications: 'In-app notifications:',
      consentMetadata: 'Consent records:',
      analytics: 'Analytics data:',
    };
    for (const row of RETENTION_MATRIX) {
      expect(privacy, row.class).toContain(labels[row.class]);
      if (row.class === 'consentMetadata') {
        expect(privacy).toContain('removed after 2 years');
        expect(privacy).toContain('up to 7 years as evidence');
      } else if (row.class === 'analytics') {
        expect(privacy).toContain('anonymised after 2 years');
      } else {
        expect(privacy, row.class).toContain(`up to ${row.horizonYears} years`);
      }
    }
    expect(privacy).toContain('then anonymised');
    expect(privacy).toContain('then minimised');
    expect(privacy).not.toContain('Retained for 2 years after the last message, then anonymised');
  });

  it('rooms keeps numbers and booleans only, so free text cannot survive anonymisation', () => {
    expect(stripRoomsText({ bedrooms: 2, kitchen: true, keyAccessNote: 'under the mat' })).toEqual({
      bedrooms: 2,
      kitchen: true,
    });
    expect(stripRoomsText(null)).toBeUndefined();
    expect(stripRoomsText(['x'])).toBeUndefined();
  });
});
