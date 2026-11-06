import { beforeEach, describe, expect, it, vi } from 'vitest';

// B7.4 (RENA-064, D-k): the export's key set equals the documented categories
// (plus the two documentation keys and exportedAt), the verification numbers
// are gone, and the notice names the categories.
const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  gdprConsent: { findMany: vi.fn() },
  notificationPreference: { findUnique: vi.fn() },
  dataRetentionLog: { create: vi.fn(), findMany: vi.fn() },
}));
vi.mock('@/lib/db/prisma', () => ({ prisma, default: prisma }));
vi.mock('./audit.service', () => ({ AuditService: { log: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('@/lib/log', () => ({ log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { EXPORT_CATEGORIES, EXPORT_NOT_INCLUDED, GdprService, exportNotice } from './gdpr.service';

const USER = {
  id: 'u1',
  role: 'CLEANER',
  name: 'Fixture Cleaner',
  email: 'b7-cleaner@integration.invalid',
  phone: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  addresses: [],
  bookingsAsClient: [],
  reviewsGiven: [
    { bookingId: 'b1', rating: 5, text: 'fine', createdAt: new Date('2026-02-01T00:00:00Z') },
  ],
  bookingsAsCleaner: [],
  cleanerProfile: {
    bio: 'x',
    hourlyRateRegular: 20,
    specialties: [],
    tier: 'STANDARD',
    location: 'E4',
    postcode: 'E4 7AA',
    radius: 5,
    verified: true,
    verificationStatus: 'VERIFIED',
    backgroundCheckPassed: true,
    dbsCertNumber: '001234567890',
    dbsCertVerified: true,
    dbsCertIssueDate: new Date('2025-01-01T00:00:00Z'),
    rightToWorkStatus: 'VERIFIED',
    rightToWorkDocType: 'passport',
    rightToWorkExpiresAt: new Date('2030-01-01T00:00:00Z'),
    identityVerifiedAt: new Date('2025-01-02T00:00:00Z'),
    rating: 4.9,
    completedJobs: 12,
    createdAt: new Date('2025-01-01T00:00:00Z'),
  },
};

describe('portability export (B7.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(USER);
    prisma.gdprConsent.findMany.mockResolvedValue([
      {
        consentType: 'marketing',
        granted: true,
        version: '1.0',
        createdAt: new Date(),
        revokedAt: null,
      },
    ]);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      reminders: true,
      newMessage: true,
      push: true,
      sms: false,
      marketing: true,
      marketingConsentAt: new Date(),
      unsubscribedAt: null,
    });
    prisma.dataRetentionLog.create.mockResolvedValue({});
  });

  it('emits exactly the documented categories (plus categories, notIncluded, exportedAt)', async () => {
    const data = await GdprService.exportUserData('u1');
    const keys = Object.keys(data).sort();
    expect(keys).toEqual(
      [...Object.keys(EXPORT_CATEGORIES), 'categories', 'notIncluded', 'exportedAt'].sort()
    );
    expect(data.categories).toEqual(EXPORT_CATEGORIES);
    expect(data.notIncluded).toEqual(EXPORT_NOT_INCLUDED);
  });

  it('a customer export omits the cleaner-only keys from its payload but keeps the documented key order', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...USER, role: 'CLIENT', cleanerProfile: null });
    const data = await GdprService.exportUserData('u1');
    expect(data.cleanerProfile).toBeNull();
    expect('jobsAsCleaner' in data).toBe(false);
  });

  it('reviews given are emitted and the verification numbers are not (approved deviation 5)', async () => {
    const data = await GdprService.exportUserData('u1');
    expect(data.reviewsGiven).toHaveLength(1);
    const text = JSON.stringify(data);
    expect(text).not.toContain('001234567890');
    expect(text).not.toContain('passport');
    expect(text).not.toContain('rightToWorkDocType');
    expect(text).not.toContain('rightToWorkExpiresAt');
    expect(data.cleanerProfile?.rightToWorkStatus).toBe('VERIFIED');
  });

  it('consents carry decisions and dates only, never IP or user agent', async () => {
    const data = await GdprService.exportUserData('u1');
    const consentSelect = prisma.gdprConsent.findMany.mock.calls[0][0].select;
    expect(Object.keys(consentSelect).sort()).toEqual(
      ['consentType', 'createdAt', 'granted', 'revokedAt', 'version'].sort()
    );
    expect(data.consents).toHaveLength(1);
    expect(data.notificationPreferences?.sms).toBe(false);
  });

  it('the notice names every category and points at the SAR path', () => {
    const notice = exportNotice();
    expect(notice).toContain('portable copy of your account data');
    for (const k of Object.keys(EXPORT_CATEGORIES)) expect(notice).toContain(k);
    expect(notice).toContain('subject access request');
    expect(notice).not.toContain('all personal data we hold');
  });
});

describe('subject access request record (B7.4)', () => {
  const admin = 'admin_1';

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.dataRetentionLog.create.mockImplementation(async ({ data }) => data);
  });

  it('refuses a reference that could carry an email or is too short', async () => {
    prisma.dataRetentionLog.findMany.mockResolvedValue([]);
    await expect(
      GdprService.recordSubjectAccessRequest({
        stage: 'received',
        reference: 'someone@example.invalid',
        adminId: admin,
      })
    ).rejects.toThrow(/never an email/);
    await expect(
      GdprService.recordSubjectAccessRequest({ stage: 'received', reference: 'ab', adminId: admin })
    ).rejects.toThrow();
  });

  it('received sets a one month deadline; extended moves it to three months from receipt; one extension only', async () => {
    const receivedAt = new Date('2026-01-31T10:00:00Z');
    prisma.dataRetentionLog.findMany.mockResolvedValue([]);
    const row = await GdprService.recordSubjectAccessRequest({
      stage: 'received',
      reference: 'SAR-2026-0001',
      adminId: admin,
      receivedAt,
    });
    const meta = (r: { metadata: unknown }) => r.metadata as { deadline: string };
    expect(meta(row).deadline).toBe(GdprService.sarDeadline(receivedAt, false).toISOString());
    prisma.dataRetentionLog.findMany.mockResolvedValue([
      { action: 'SAR_RECEIVED', metadata: { receivedAt: receivedAt.toISOString() } },
    ]);
    const ext = await GdprService.recordSubjectAccessRequest({
      stage: 'extended',
      reference: 'SAR-2026-0001',
      adminId: admin,
    });
    expect(meta(ext).deadline).toBe(GdprService.sarDeadline(receivedAt, true).toISOString());
    prisma.dataRetentionLog.findMany.mockResolvedValue([
      { action: 'SAR_RECEIVED', metadata: { receivedAt: receivedAt.toISOString() } },
      { action: 'SAR_EXTENDED', metadata: {} },
    ]);
    await expect(
      GdprService.recordSubjectAccessRequest({
        stage: 'extended',
        reference: 'SAR-2026-0001',
        adminId: admin,
      })
    ).rejects.toThrow(/once/);
  });

  it('stages out of order are refused: extend or fulfil before received, fulfil twice', async () => {
    prisma.dataRetentionLog.findMany.mockResolvedValue([]);
    await expect(
      GdprService.recordSubjectAccessRequest({
        stage: 'fulfilled',
        reference: 'SAR-1',
        adminId: admin,
      })
    ).rejects.toThrow(/received first/);
    prisma.dataRetentionLog.findMany.mockResolvedValue([
      { action: 'SAR_RECEIVED', metadata: { receivedAt: '2026-01-01T00:00:00Z' } },
      { action: 'SAR_FULFILLED', metadata: {} },
    ]);
    await expect(
      GdprService.recordSubjectAccessRequest({
        stage: 'fulfilled',
        reference: 'SAR-1',
        adminId: admin,
      })
    ).rejects.toThrow(/already fulfilled/);
  });

  it('the summary derives status, the applicable deadline and overdue from the rows', () => {
    const now = new Date('2026-03-15T00:00:00Z');
    const rows = [
      {
        entityId: 'SAR-A',
        action: 'SAR_RECEIVED',
        createdAt: new Date('2026-01-05'),
        metadata: { receivedAt: '2026-01-05T00:00:00Z', deadline: '2026-02-05T00:00:00Z' },
      },
      {
        entityId: 'SAR-B',
        action: 'SAR_RECEIVED',
        createdAt: new Date('2026-01-10'),
        metadata: { receivedAt: '2026-01-10T00:00:00Z', deadline: '2026-02-10T00:00:00Z' },
      },
      {
        entityId: 'SAR-B',
        action: 'SAR_EXTENDED',
        createdAt: new Date('2026-02-01'),
        metadata: { deadline: '2026-04-10T00:00:00Z' },
      },
      {
        entityId: 'SAR-C',
        action: 'SAR_RECEIVED',
        createdAt: new Date('2026-01-12'),
        metadata: { receivedAt: '2026-01-12T00:00:00Z', deadline: '2026-02-12T00:00:00Z' },
      },
      {
        entityId: 'SAR-C',
        action: 'SAR_FULFILLED',
        createdAt: new Date('2026-02-01'),
        metadata: {},
      },
    ];
    const out = GdprService.summariseSubjectAccessRequests(rows, now);
    expect(out.map((r) => [r.reference, r.status, r.overdue, r.extended])).toEqual([
      ['SAR-A', 'OPEN', true, false],
      ['SAR-B', 'OPEN', false, true],
      ['SAR-C', 'FULFILLED', false, false],
    ]);
    expect(out[1].deadline).toBe('2026-04-10T00:00:00Z');
  });
});
