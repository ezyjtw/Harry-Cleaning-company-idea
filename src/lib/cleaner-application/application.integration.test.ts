import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';
import type * as StorageModule from '@/lib/services/document-storage.service';
import type * as IncompleteModule from '@/lib/services/incomplete-signup.service';

import type * as LifecycleModule from './lifecycle';
import type * as ServiceModule from './service';

// RENA-100/101 (James-ruled 2026-10-08) laws against a real Postgres (register
// rule 7: a concurrency or invariant fix ships with a concurrency test on the
// rig). Opt-in: CLEANER_APPLICATION_INTEGRATION=1 with DATABASE_URL pointing
// at a migrated database. Storage is an in-memory object map (so object
// deletion is observable), email, postcode lookup and catchment are faked.
// Synthetic users only (@integration.invalid).
const enabled = process.env.CLEANER_APPLICATION_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const REPS = Number(process.env.CLEANER_APPLICATION_REPS || 20);

const store = vi.hoisted(() => ({
  objects: new Map<string, Buffer>(),
  failPut: false,
  failDelete: false,
}));
vi.mock('@/lib/storage/r2-client', () => ({
  putObject: async (key: string, body: Buffer) => {
    if (store.failPut) throw new Error('storage down');
    store.objects.set(key, Buffer.from(body));
  },
  getObject: async (key: string) => {
    const b = store.objects.get(key);
    if (!b) throw new Error('missing object');
    return b;
  },
  deleteObject: async (key: string) => {
    if (store.failDelete) throw new Error('storage down');
    store.objects.delete(key);
  },
  resolveProfileImageUrl: async () => null,
  getPresignedDownloadUrl: async () => '',
  getCachedPresignedUrl: async () => '',
}));
const mail = vi.hoisted(() => ({ inactivity: [] as string[], expiry: [] as string[] }));
vi.mock('@/lib/services/email.service', () => ({
  sendApplicationInactivityReminder: async (email: string) => {
    mail.inactivity.push(email);
    return true;
  },
  sendApplicationExpiryReminder: async (email: string) => {
    mail.expiry.push(email);
    return true;
  },
  sendSignupNotification: async () => true,
}));
vi.mock('@/lib/utils/postcode', () => ({
  lookupPostcodeOutcome: async () => ({
    status: 'found',
    result: { latitude: 51.6, longitude: -0.01 },
  }),
}));
vi.mock('@/lib/services/catchment-generation.service', () => ({
  triggerCatchmentRefresh: () => {},
}));

// A real PNG (magic bytes checked by the upload validator).
const PNG = `data:image/png;base64,${Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
).toString('base64')}`;

const DATA = {
  firstName: 'Rig',
  lastName: 'Applicant',
  phone: '07700900123',
  postcode: 'E4 6AP',
  yearsExperience: '5',
  serviceTypes: ['regular'],
  specialties: [],
  languages: ['English'],
  bio: 'Synthetic rig applicant.',
  serviceRates: { regular: '18' },
  hoursPerWeek: '20',
  maxTravelMinutes: '30',
  rightToWorkDocType: 'uk_passport',
  rightToWorkShareCode: '',
  rightToWorkExpiryDate: '',
  dbsOption: 'none',
  dbsCertNumber: '',
  dbsCertIssueDate: '',
  selfieProvenance: 'capture',
  livenessComplete: true,
  acknowledgeSelfEmployment: true,
};
const DOB = '1990-04-06';

describe.skipIf(!enabled)('cleaner application against Postgres (RENA-100, 101)', () => {
  let prisma: typeof PrismaDefault;
  let svc: typeof ServiceModule;
  let life: typeof LifecycleModule;
  let incomplete: typeof IncompleteModule;
  let storage: typeof StorageModule;
  const PREFIX = 'rena-app-it-';
  let seq = 0;

  async function cleanup() {
    const users = await prisma.user.findMany({
      where: { email: { startsWith: PREFIX } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (!ids.length) return;
    await prisma.documentUpload.deleteMany({ where: { userId: { in: ids } } });
    await prisma.agreementAcceptance.deleteMany({ where: { cleanerId: { in: ids } } });
    await prisma.cleanerProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  async function applicant(role: 'CLEANER' | 'ADMIN' = 'CLEANER', ageDays = 0) {
    seq += 1;
    return prisma.user.create({
      data: {
        email: `${PREFIX}${Date.now()}-${seq}@integration.invalid`,
        name: 'Rig Applicant',
        role,
        passwordHash: 'x',
        createdAt: new Date(Date.now() - ageDays * 86400000),
      },
    });
  }

  /** Walk a fresh applicant through every saved step (0..5) with documents. */
  async function completeDraft(userId: string): Promise<number> {
    let v = 0;
    for (let step = 0; step <= 5; step += 1) {
      if (step === 3) {
        expect(
          (await svc.uploadDraftDocument(userId, { category: 'photo_id', fileData: PNG })).ok
        ).toBe(true);
        expect(
          (await svc.uploadDraftDocument(userId, { category: 'right_to_work', fileData: PNG })).ok
        ).toBe(true);
      }
      if (step === 4) {
        expect(
          (await svc.uploadDraftDocument(userId, { category: 'selfie', fileData: PNG })).ok
        ).toBe(true);
      }
      const r = await svc.saveApplicationStep(userId, {
        version: v,
        completedStep: step,
        data: DATA,
        dateOfBirth: DOB,
      });
      expect(r.ok, JSON.stringify(r)).toBe(true);
      if (r.ok) v = r.version;
    }
    return v;
  }

  const req = (headers: Record<string, string> = {}) => ({
    headers: new Headers(headers),
    ipAddress: '198.51.100.20',
    userAgent: 'vitest',
  });

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'integration-secret';
    process.env.DOCUMENT_ENCRYPTION_KEY =
      process.env.DOCUMENT_ENCRYPTION_KEY || 'integration-only-document-encryption-key-012345';
    prisma = (await import('@/lib/db/prisma')).default;
    svc = await import('./service');
    life = await import('./lifecycle');
    incomplete = await import('@/lib/services/incomplete-signup.service');
    storage = await import('@/lib/services/document-storage.service');
    await cleanup();
  });

  beforeEach(() => {
    store.failPut = false;
    store.failDelete = false;
    mail.inactivity.length = 0;
    mail.expiry.length = 0;
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it('A1. the first save creates the draft keyed to the user; the server decides the step', async () => {
    const u = await applicant();
    const r = await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: { ...DATA, password: 'never-stored', email: 'x@y.invalid', injected: 'dropped' },
      dateOfBirth: DOB,
    });
    expect(r).toMatchObject({ ok: true, version: 1, currentStep: 1, maxReachedStep: 1 });
    const row = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
    expect(row?.currentStep).toBe(1);
    const stored = row?.data as Record<string, unknown>;
    expect(stored.password).toBeUndefined();
    expect(stored.email).toBeUndefined();
    expect(stored.injected).toBeUndefined();
    expect(row?.dateOfBirth?.toISOString().slice(0, 10)).toBe(DOB);
  });

  it(`A2. two saves of one version at once: exactly one lands, the other is 409 (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i += 1) {
      const u = await applicant();
      await svc.saveApplicationStep(u.id, {
        version: 0,
        completedStep: 0,
        data: DATA,
        dateOfBirth: DOB,
      });
      const [a, b] = await Promise.all([
        svc.saveApplicationStep(u.id, {
          version: 1,
          completedStep: 1,
          data: DATA,
          dateOfBirth: DOB,
        }),
        svc.saveApplicationStep(u.id, {
          version: 1,
          completedStep: 1,
          data: { ...DATA, bio: 'other device' },
          dateOfBirth: DOB,
        }),
      ]);
      const oks = [a, b].filter((r) => r.ok);
      const conflicts = [a, b].filter((r) => !r.ok && r.code === 'APPLICATION_UPDATED');
      expect(oks).toHaveLength(1);
      expect(conflicts).toHaveLength(1);
      const row = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
      expect(row?.version).toBe(2);
    }
  });

  it('A3. a stale device: a save carrying an old version is 409 APPLICATION_UPDATED and changes nothing', async () => {
    const u = await applicant();
    await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    await svc.saveApplicationStep(u.id, {
      version: 1,
      completedStep: 1,
      data: DATA,
      dateOfBirth: DOB,
    });
    const stale = await svc.saveApplicationStep(u.id, {
      version: 1,
      completedStep: 1,
      data: { ...DATA, bio: 'stale' },
      dateOfBirth: DOB,
    });
    expect(stale).toMatchObject({ ok: false, status: 409, code: 'APPLICATION_UPDATED' });
    const again0 = await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    expect(again0).toMatchObject({ ok: false, code: 'APPLICATION_UPDATED' });
    const row = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
    expect((row?.data as Record<string, unknown>).bio).toBe(DATA.bio);
    expect(row?.version).toBe(2);
  });

  it('A4. ownership: another applicant can neither read, remove nor replace your document; an admin can read', async () => {
    const a = await applicant();
    const b = await applicant();
    const admin = await applicant('ADMIN');
    await svc.saveApplicationStep(a.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    await svc.saveApplicationStep(b.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    const up = await svc.uploadDraftDocument(a.id, { category: 'photo_id', fileData: PNG });
    expect(up.ok).toBe(true);
    const id = up.ok ? up.document.id : '';
    expect(await svc.readApplicationDocument({ id: b.id, role: 'CLEANER' }, id)).toBeNull();
    expect(await svc.readApplicationDocument({ id: a.id, role: 'CLEANER' }, id)).not.toBeNull();
    expect(await svc.readApplicationDocument({ id: admin.id, role: 'ADMIN' }, id)).not.toBeNull();
    expect(await svc.removeDraftDocument(b.id, id)).toMatchObject({ ok: false, status: 404 });
    const hijack = await svc.uploadDraftDocument(b.id, {
      category: 'photo_id',
      fileData: PNG,
      replaceId: id,
    });
    expect(hijack).toMatchObject({ ok: false, code: 'DOCUMENT_CHANGED' });
    const row = await prisma.documentUpload.findUnique({ where: { id } });
    expect(row?.isDestroyed).toBe(false);
    expect(row?.userId).toBe(a.id);
  });

  it(`A5. one active draft per category: concurrent first uploads give one winner and no stray object (${REPS} reps); replacement is explicit and retires the old object`, async () => {
    for (let i = 0; i < REPS; i += 1) {
      const u = await applicant();
      await svc.saveApplicationStep(u.id, {
        version: 0,
        completedStep: 0,
        data: DATA,
        dateOfBirth: DOB,
      });
      const before = store.objects.size;
      const rs = await Promise.all([
        svc.uploadDraftDocument(u.id, { category: 'selfie', fileData: PNG }),
        svc.uploadDraftDocument(u.id, { category: 'selfie', fileData: PNG }),
      ]);
      expect(rs.filter((r) => r.ok)).toHaveLength(1);
      const active = await prisma.documentUpload.findMany({
        where: {
          userId: u.id,
          documentType: 'selfie',
          reviewState: 'DRAFT',
          storageState: 'STORED',
          isDestroyed: false,
        },
      });
      expect(active).toHaveLength(1);
      expect(store.objects.size - before).toBe(1);
      expect(store.objects.has(active[0].storagePath)).toBe(true);
    }
    const u = await applicant();
    await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    const first = await svc.uploadDraftDocument(u.id, { category: 'photo_id', fileData: PNG });
    const firstId = first.ok ? first.document.id : '';
    const firstRow = await prisma.documentUpload.findUnique({ where: { id: firstId } });
    expect(
      await svc.uploadDraftDocument(u.id, { category: 'photo_id', fileData: PNG })
    ).toMatchObject({
      ok: false,
      code: 'DOCUMENT_CHANGED',
    });
    const second = await svc.uploadDraftDocument(u.id, {
      category: 'photo_id',
      fileData: PNG,
      replaceId: firstId,
    });
    expect(second.ok).toBe(true);
    const old = await prisma.documentUpload.findUnique({ where: { id: firstId } });
    expect(old).toMatchObject({
      isDestroyed: true,
      destroyedReason: 'replaced',
      storageState: 'DELETED',
    });
    expect(store.objects.has(firstRow?.storagePath ?? '')).toBe(false);
  });

  it('A6. an upload failure keeps progress: no row, no object, the draft untouched', async () => {
    const u = await applicant();
    await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    const before = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
    store.failPut = true;
    const r = await svc.uploadDraftDocument(u.id, { category: 'photo_id', fileData: PNG });
    expect(r).toMatchObject({ ok: false, status: 502, code: 'UPLOAD_FAILED' });
    expect(await prisma.documentUpload.count({ where: { userId: u.id } })).toBe(0);
    const after = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
    expect(after?.version).toBe(before?.version);
    expect(after?.currentStep).toBe(before?.currentStep);
    store.failPut = false;
    expect((await svc.uploadDraftDocument(u.id, { category: 'photo_id', fileData: PNG })).ok).toBe(
      true
    );
  });

  it('A7. a step needing documents refuses to save without STORED ones; a PENDING row does not count', async () => {
    const u = await applicant();
    let v = 0;
    for (let s = 0; s <= 2; s += 1) {
      const r = await svc.saveApplicationStep(u.id, {
        version: v,
        completedStep: s,
        data: DATA,
        dateOfBirth: DOB,
      });
      if (r.ok) v = r.version;
    }
    await prisma.documentUpload.createMany({
      data: ['photo_id', 'right_to_work'].map((t) => ({
        userId: u.id,
        documentType: t,
        originalName: `${t}.png`,
        storagePath: `documents/${t}/pending-${u.id}.enc`,
        mimeType: 'image/png',
        fileSize: 1,
        encryptionKeyId: 'k',
        checksum: 'c',
        reviewState: 'DRAFT' as const,
        storageState: 'PENDING' as const,
      })),
    });
    const r = await svc.saveApplicationStep(u.id, {
      version: v,
      completedStep: 3,
      data: DATA,
      dateOfBirth: DOB,
    });
    expect(r).toMatchObject({ ok: false, status: 400, code: 'STEP_INCOMPLETE', step: 3 });
  });

  it('A8. finalise: incomplete is refused at its step; complete creates profile, agreement, vetting and SUBMITTED documents; once only', async () => {
    const u = await applicant();
    await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    const early = await svc.finaliseApplication(
      { userId: u.id, sessionJti: null },
      { version: 1, agreedToTerms: true },
      req()
    );
    expect(early).toMatchObject({ ok: false, status: 400, code: 'STEP_INCOMPLETE' });
    expect(await prisma.cleanerProfile.count({ where: { userId: u.id } })).toBe(0);

    const u2 = await applicant();
    const v = await completeDraft(u2.id);
    const [x, y] = await Promise.all([
      svc.finaliseApplication(
        { userId: u2.id, sessionJti: null },
        { version: v, agreedToTerms: true },
        req()
      ),
      svc.finaliseApplication(
        { userId: u2.id, sessionJti: null },
        { version: v, agreedToTerms: true },
        req()
      ),
    ]);
    expect([x, y].filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.cleanerProfile.count({ where: { userId: u2.id } })).toBe(1);
    expect(await prisma.agreementAcceptance.count({ where: { cleanerId: u2.id } })).toBe(1);
    const vetting = await prisma.cleanerVetting.findUnique({ where: { userId: u2.id } });
    expect(vetting?.dateOfBirth.toISOString().slice(0, 10)).toBe(DOB);
    const docs = await prisma.documentUpload.findMany({
      where: { userId: u2.id, isDestroyed: false },
    });
    expect(docs.length).toBe(3);
    expect(docs.every((d) => d.reviewState === 'SUBMITTED' && d.profileId)).toBe(true);
    const draft = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u2.id } });
    expect(draft?.status).toBe('SUBMITTED');
    const again = await svc.finaliseApplication(
      { userId: u2.id, sessionJti: null },
      { version: draft?.version, agreedToTerms: true },
      req()
    );
    expect(again).toMatchObject({ ok: false, code: 'APPLICATION_SUBMITTED' });
  });

  it('A9. a forced finalisation failure leaves the draft resumable; the retry succeeds', async () => {
    const u = await applicant();
    const v = await completeDraft(u.id);
    await expect(
      svc.finaliseApplication(
        { userId: u.id, sessionJti: null },
        { version: v, agreedToTerms: true },
        req(),
        {
          beforeCommit: async () => {
            throw new Error('forced failure');
          },
        }
      )
    ).rejects.toThrow('forced failure');
    expect(await prisma.cleanerProfile.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.cleanerVetting.count({ where: { userId: u.id } })).toBe(0);
    const draft = await prisma.cleanerApplicationDraft.findUnique({ where: { userId: u.id } });
    expect(draft).toMatchObject({ status: 'IN_PROGRESS', version: v });
    expect(
      await prisma.documentUpload.count({
        where: { userId: u.id, reviewState: 'DRAFT', storageState: 'STORED' },
      })
    ).toBe(3);
    const retry = await svc.finaliseApplication(
      { userId: u.id, sessionJti: null },
      { version: v, agreedToTerms: true },
      req()
    );
    expect(retry.ok).toBe(true);
  });

  it('A10. the handoff decision: signed into Pro gets none and Today; the logged-out shell gets a code; the website gets none', async () => {
    const { mintDeviceSession } = await import('@/lib/auth/device-session');
    const exp = new Date(Date.now() + 3600000);
    const cases: [
      string,
      (uid: string) => Promise<{ jti: string | null; headers: Record<string, string> }>,
      unknown,
    ][] = [
      [
        'bridged pane',
        async (uid) => {
          const bearer = await mintDeviceSession({
            userId: uid,
            kind: 'BEARER',
            label: 'pro',
            sv: 0,
            expiresAt: exp,
          });
          const web = await mintDeviceSession({
            userId: uid,
            kind: 'WEB',
            label: 'pane',
            sv: 0,
            expiresAt: exp,
            parentJti: bearer.jti,
          });
          return { jti: web.jti, headers: { 'x-rena-shell': 'pro-ios/1.0.3' } };
        },
        { handoff: 'none', next: '/app/today' },
      ],
      [
        'logged-out native join',
        async (uid) => {
          const web = await mintDeviceSession({
            userId: uid,
            kind: 'WEB',
            label: 'join',
            sv: 0,
            expiresAt: exp,
          });
          return { jti: web.jti, headers: { 'x-rena-shell': 'pro-ios/1.0.3' } };
        },
        { handoff: 'code', next: null },
      ],
      [
        'website',
        async (uid) => {
          const web = await mintDeviceSession({
            userId: uid,
            kind: 'WEB',
            label: 'web',
            sv: 0,
            expiresAt: exp,
          });
          return { jti: web.jti, headers: {} };
        },
        { handoff: 'none', next: '/cleaner' },
      ],
    ];
    for (const [label, make, want] of cases) {
      const u = await applicant();
      const v = await completeDraft(u.id);
      const { jti, headers } = await make(u.id);
      const r = await svc.finaliseApplication(
        { userId: u.id, sessionJti: jti },
        { version: v, agreedToTerms: true },
        req(headers)
      );
      expect(r, label).toMatchObject({ ok: true, ...(want as object) });
      if (r.ok && r.handoff === 'code') expect(r.handoffCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('A11. reminders: each sends exactly once across repeated and overlapping runs; resume, submit and expiry-exempt suppress', async () => {
    const day = 86400000;
    const now = new Date();
    const idle3 = await applicant();
    const idle28 = await applicant();
    const fresh = await applicant();
    for (const u of [idle3, idle28, fresh]) {
      await svc.saveApplicationStep(u.id, {
        version: 0,
        completedStep: 0,
        data: DATA,
        dateOfBirth: DOB,
      });
    }
    await prisma.cleanerApplicationDraft.update({
      where: { userId: idle3.id },
      data: { lastActivityAt: new Date(now.getTime() - 3 * day) },
    });
    await prisma.cleanerApplicationDraft.update({
      where: { userId: idle28.id },
      data: { lastActivityAt: new Date(now.getTime() - 28 * day) },
    });
    await Promise.all([life.sendApplicationReminders(now), life.sendApplicationReminders(now)]);
    await life.sendApplicationReminders(now);
    await life.sendApplicationReminders(new Date(now.getTime() + day));
    const mine = (list: string[], email: string) => list.filter((e) => e === email).length;
    expect(mine(mail.inactivity, idle3.email)).toBe(1);
    expect(mine(mail.expiry, idle3.email)).toBe(0);
    expect(mine(mail.inactivity, idle28.email)).toBe(1);
    expect(mine(mail.expiry, idle28.email)).toBe(1);
    expect(mine(mail.inactivity, fresh.email)).toBe(0);
  });

  it('A12. expiry: 30 idle days removes the draft, its documents and their objects, and the account; an active draft on an old account stays', async () => {
    const day = 86400000;
    const old = await applicant('CLEANER', 40);
    const active = await applicant('CLEANER', 40);
    for (const u of [old, active]) {
      await svc.saveApplicationStep(u.id, {
        version: 0,
        completedStep: 0,
        data: DATA,
        dateOfBirth: DOB,
      });
      await svc.uploadDraftDocument(u.id, { category: 'photo_id', fileData: PNG });
    }
    const paths = (
      await prisma.documentUpload.findMany({
        where: { userId: old.id },
        select: { storagePath: true },
      })
    ).map((d) => d.storagePath);
    await prisma.cleanerApplicationDraft.update({
      where: { userId: old.id },
      data: { lastActivityAt: new Date(Date.now() - 31 * day) },
    });
    await prisma.cleanerApplicationDraft.update({
      where: { userId: active.id },
      data: { lastActivityAt: new Date(Date.now() - 10 * day) },
    });
    await incomplete.sweepIncompleteSignups();
    await incomplete.sweepIncompleteSignups();
    expect(await prisma.user.findUnique({ where: { id: old.id } })).toBeNull();
    expect(
      await prisma.cleanerApplicationDraft.findUnique({ where: { userId: old.id } })
    ).toBeNull();
    expect(await prisma.documentUpload.count({ where: { userId: old.id } })).toBe(0);
    for (const p of paths) expect(store.objects.has(p)).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: active.id } })).not.toBeNull();
  });

  it('A13. admin removal deletes objects and sessions; a storage failure refuses the removal and keeps everything', async () => {
    const { mintDeviceSession } = await import('@/lib/auth/device-session');
    const u = await applicant();
    await svc.saveApplicationStep(u.id, {
      version: 0,
      completedStep: 0,
      data: DATA,
      dateOfBirth: DOB,
    });
    await svc.uploadDraftDocument(u.id, { category: 'selfie', fileData: PNG });
    await mintDeviceSession({
      userId: u.id,
      kind: 'WEB',
      label: 'web',
      sv: 0,
      expiresAt: new Date(Date.now() + 3600000),
    });
    store.failDelete = true;
    expect(await incomplete.removeIncompleteSignup({ userId: u.id })).toMatchObject({
      ok: false,
      status: 503,
    });
    expect(await prisma.user.findUnique({ where: { id: u.id } })).not.toBeNull();
    store.failDelete = false;
    const path =
      (await prisma.documentUpload.findFirst({ where: { userId: u.id } }))?.storagePath ?? '';
    expect(await incomplete.removeIncompleteSignup({ userId: u.id })).toMatchObject({ ok: true });
    expect(store.objects.has(path)).toBe(false);
    expect(await prisma.deviceSession.count({ where: { userId: u.id } })).toBe(0);
    expect(await prisma.user.findUnique({ where: { id: u.id } })).toBeNull();
  });

  it('A14. the integrity sweep clears a stale PENDING upload with its object and retries a failed retire', async () => {
    const u = await applicant();
    const old = new Date(Date.now() - 2 * 3600000);
    store.objects.set(`documents/selfie/stale-${u.id}.enc`, Buffer.from('x'));
    store.objects.set(`documents/selfie/retired-${u.id}.enc`, Buffer.from('y'));
    await prisma.documentUpload.create({
      data: {
        userId: u.id,
        documentType: 'selfie',
        originalName: 's.png',
        storagePath: `documents/selfie/stale-${u.id}.enc`,
        mimeType: 'image/png',
        fileSize: 1,
        encryptionKeyId: 'k',
        checksum: 'c',
        storageState: 'PENDING',
        reviewState: 'DRAFT',
        createdAt: old,
      },
    });
    const retired = await prisma.documentUpload.create({
      data: {
        userId: u.id,
        documentType: 'selfie',
        originalName: 's.png',
        storagePath: `documents/selfie/retired-${u.id}.enc`,
        mimeType: 'image/png',
        fileSize: 1,
        encryptionKeyId: 'k',
        checksum: 'c',
        storageState: 'STORED',
        reviewState: 'DRAFT',
        isDestroyed: true,
        destroyedAt: old,
        destroyedReason: 'replaced',
      },
    });
    await storage.DocumentStorageService.sweepIncompleteUploads();
    await storage.DocumentStorageService.sweepIncompleteUploads();
    expect(store.objects.has(`documents/selfie/stale-${u.id}.enc`)).toBe(false);
    expect(store.objects.has(`documents/selfie/retired-${u.id}.enc`)).toBe(false);
    expect(
      await prisma.documentUpload.count({ where: { userId: u.id, storageState: 'PENDING' } })
    ).toBe(0);
    expect(
      (await prisma.documentUpload.findUnique({ where: { id: retired.id } }))?.storageState
    ).toBe('DELETED');
  });
});
