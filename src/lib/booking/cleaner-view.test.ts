import { describe, expect, it } from 'vitest';

import { normalizeCleanerJob } from './cleaner-job-display';
import {
  PRE_ACCEPT_KEYS,
  firstNameOf,
  isAssignedTo,
  outwardCode,
  serializePreAccept,
} from './cleaner-view';

// B3.3 (RENA-026, James-ruled): the pre-accept payload. Synthetic fixture
// names only; no real person.
const VIEWER = 'cleaner-viewer';
const PRIMARY = 'cleaner-primary';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bk_1',
    status: 'AWAITING_CLEANER',
    cleanerId: PRIMARY,
    cascadePhase: 'BACKUP_OFFER',
    cascadeExpiresAt: new Date('2026-11-01T10:00:00Z'),
    backupCleanerIds: [VIEWER],
    reserveCleanerIds: [],
    provisionalCleanerId: null,
    date: new Date('2026-11-03T00:00:00Z'),
    startTime: '10:00',
    duration: 3,
    serviceType: 'regular',
    propertySize: 'TWO_BED',
    extras: ['oven'],
    suppliesProvided: true,
    cleanerEarnings: 54,
    rooms: { bedrooms: 2, keyAccess: 'lockbox', keyAccessNote: 'code 1234' },
    guestName: null,
    addressPostcode: 'E4 7AA',
    addressCity: 'Chingford',
    // Present on the row; must never leave through the pre-accept view.
    notes: 'Gate code 9876',
    cleanerNotes: 'private',
    addressLine1: '1 Example Road',
    paymentStatus: 'SUCCEEDED',
    client: { name: 'Testa Fixture-Surname', email: 'fixture@integration.invalid' },
    agreement: null,
    ...overrides,
  } as never;
}

describe('serializePreAccept', () => {
  it('a backup viewing an AWAITING_CLEANER row gets exactly the ruled key set', () => {
    const v = serializePreAccept(row(), VIEWER, { viewerEarnings: 61.5 });
    expect(Object.keys(v).sort()).toEqual([...PRE_ACCEPT_KEYS].sort());
    expect(v.customerFirstName).toBe('Testa');
    expect(v.postcode).toBe('E4');
    expect(v.city).toBe('Chingford');
    expect(v.cleanerEarnings).toBe(61.5);
    expect(v.isBackup).toBe(true);
    expect(v.isPrimary).toBe(false);
    expect(v.bedrooms).toBe(2);
    expect(v.context).toEqual({ travelMinutes: null, sameDayJobs: null });
  });

  it('the primary viewing their own offer gets the same key set and the stored figure', () => {
    const v = serializePreAccept(
      row({ cascadePhase: 'PRIMARY_OFFER', backupCleanerIds: [] }),
      PRIMARY,
      {
        viewerEarnings: 99,
        context: { travelMinutes: 25, sameDayJobs: 1 },
      }
    );
    expect(Object.keys(v).sort()).toEqual([...PRE_ACCEPT_KEYS].sort());
    expect(v.isPrimary).toBe(true);
    // The primary's figure is the stored one (the payout function's), never a quote.
    expect(v.cleanerEarnings).toBe(54);
    expect(v.context).toEqual({ travelMinutes: 25, sameDayJobs: 1 });
  });

  it('carries no email, surname, street, notes, key access or payment status', () => {
    const json = JSON.stringify(serializePreAccept(row(), VIEWER, {}));
    for (const leak of [
      'fixture@integration.invalid',
      'Fixture-Surname',
      '1 Example Road',
      'Gate code',
      'private',
      'lockbox',
      'code 1234',
      '7AA',
      'paymentStatus',
      'SUCCEEDED',
    ]) {
      expect(json).not.toContain(leak);
    }
  });

  it('a guest booking takes the first token of the guest name', () => {
    const v = serializePreAccept(row({ client: null, guestName: 'Guesta Example' }), VIEWER, {});
    expect(v.customerFirstName).toBe('Guesta');
  });

  it('the list route speaks lowercase statuses', () => {
    expect(serializePreAccept(row(), VIEWER, { lowercaseStatus: true }).status).toBe(
      'awaiting_cleaner'
    );
  });
});

describe('isAssignedTo', () => {
  it('only the row cleaner, and only past the offer states', () => {
    expect(isAssignedTo({ cleanerId: VIEWER, status: 'ACCEPTED' } as never, VIEWER)).toBe(true);
    expect(isAssignedTo({ cleanerId: VIEWER, status: 'CONFIRMED' } as never, VIEWER)).toBe(true);
    for (const status of ['PENDING', 'AWAITING_CLEANER', 'CASCADE_EXHAUSTED']) {
      expect(isAssignedTo({ cleanerId: VIEWER, status } as never, VIEWER)).toBe(false);
    }
    expect(isAssignedTo({ cleanerId: PRIMARY, status: 'ACCEPTED' } as never, VIEWER)).toBe(false);
  });

  it('a booking cancelled before the pinned primary accepted is not assigned to them', () => {
    // Customer cancels a paid PRIMARY_OFFER: cleanerId stays pinned, the
    // cascade fields clear, acceptedAt was never set.
    expect(
      isAssignedTo({ cleanerId: VIEWER, status: 'CANCELLED', acceptedAt: null } as never, VIEWER)
    ).toBe(false);
    expect(
      isAssignedTo(
        { cleanerId: VIEWER, status: 'CANCELLED', acceptedAt: new Date() } as never,
        VIEWER
      )
    ).toBe(true);
  });

  it("a cancelled occurrence of the viewer's own agreement stays assigned (acceptance is the agreement)", () => {
    expect(
      isAssignedTo(
        {
          cleanerId: VIEWER,
          status: 'CANCELLED',
          acceptedAt: null,
          agreement: { cleanerId: VIEWER },
        } as never,
        VIEWER
      )
    ).toBe(true);
    expect(
      isAssignedTo(
        {
          cleanerId: VIEWER,
          status: 'CANCELLED',
          acceptedAt: null,
          agreement: { cleanerId: PRIMARY },
        } as never,
        VIEWER
      )
    ).toBe(false);
  });
});

describe('outwardCode and firstNameOf', () => {
  it.each([
    ['E4 7AA', 'E4'],
    ['e47aa', 'E4'],
    ['SW1A 1AA', 'SW1A'],
    ['EC1V 9HX', 'EC1V'],
    ['M1 1AE', 'M1'],
    ['', null],
    ['not a postcode at all', null],
  ])('%s → %s', (pc, out) => {
    expect(outwardCode(pc)).toBe(out);
  });

  it('first names', () => {
    expect(firstNameOf('  Alpha  Beta Gamma ')).toBe('Alpha');
    expect(firstNameOf('')).toBeNull();
    expect(firstNameOf(null)).toBeNull();
  });
});

describe('normalizeCleanerJob (client adapter)', () => {
  it('fills the card fields for a pre-accept row', () => {
    const n = normalizeCleanerJob({
      customerFirstName: 'Testa',
      postcode: 'E4',
      city: 'Chingford',
      status: 'awaiting_cleaner',
    });
    expect(n.clientName).toBe('Testa');
    expect(n.address).toBe('E4, Chingford');
    expect(n.isOffer).toBe(true);
  });

  it('leaves an assigned row as it was', () => {
    const n = normalizeCleanerJob({
      clientName: 'Full Name',
      address: '1 Road, E4 7AA',
      status: 'accepted',
      isOffer: false,
    });
    expect(n.clientName).toBe('Full Name');
    expect(n.address).toBe('1 Road, E4 7AA');
    expect(n.isOffer).toBe(false);
  });
});
