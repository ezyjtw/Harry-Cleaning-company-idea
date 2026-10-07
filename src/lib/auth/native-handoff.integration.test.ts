import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';

import type * as HandoffModule from './native-handoff';
import type * as SessionModule from './session';

// B5 (RENA-031/082) handoff laws against a real Postgres (register rule 7:
// a concurrency or invariant fix ships with a concurrency test against the
// rig). Opt-in: runs only when NATIVE_HANDOFF_INTEGRATION=1 and DATABASE_URL
// point at a migrated database. Synthetic users only (@integration.invalid).
const enabled = process.env.NATIVE_HANDOFF_INTEGRATION === '1' && !!process.env.DATABASE_URL;
const REPS = Number(process.env.NATIVE_HANDOFF_REPS || 30);

describe.skipIf(!enabled)('native handoff code against Postgres (B5, RENA-031/082)', () => {
  let prisma: typeof PrismaDefault;
  let handoff: typeof HandoffModule;
  let session: typeof SessionModule;
  const EMAIL_CLEANER = 'b5-handoff-cleaner@integration.invalid';
  const EMAIL_CLIENT = 'b5-handoff-client@integration.invalid';
  const EMAIL_SIGNUP = 'b5-handoff-signup@integration.invalid';
  const EMAIL_WEB = 'b5-handoff-web@integration.invalid';
  const ALL = [EMAIL_CLEANER, EMAIL_CLIENT, EMAIL_SIGNUP, EMAIL_WEB];
  let cleaner: { id: string };
  let client: { id: string };

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { in: ALL } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.nativeHandoffCode.deleteMany({ where: { userId: { in: ids } } });
      await prisma.deviceSession.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  }

  const bearerRows = (userId: string) =>
    prisma.deviceSession.count({ where: { userId, kind: 'BEARER' } });

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'integration-secret';
    prisma = (await import('@/lib/db/prisma')).default;
    handoff = await import('./native-handoff');
    session = await import('./session');
    await cleanup();
    cleaner = await prisma.user.create({
      data: { email: EMAIL_CLEANER, name: 'Handoff Cleaner', role: 'CLEANER', passwordHash: 'x' },
    });
    client = await prisma.user.create({
      data: { email: EMAIL_CLIENT, name: 'Handoff Client', role: 'CLIENT', passwordHash: 'x' },
    });
  });

  beforeEach(async () => {
    await prisma.nativeHandoffCode.deleteMany({
      where: { userId: { in: [cleaner.id, client.id] } },
    });
    await prisma.deviceSession.deleteMany({ where: { userId: { in: [cleaner.id, client.id] } } });
    await prisma.user.updateMany({
      where: { id: { in: [cleaner.id, client.id] } },
      data: { accountStatus: 'ACTIVE', isSuspended: false, isDeleted: false },
    });
    await prisma.user.update({ where: { id: cleaner.id }, data: { role: 'CLEANER' } });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it('H1. a code redeems once into a BEARER row and a bridge code that bridges once; only its hash is stored', async () => {
    const code = await handoff.mintNativeHandoffCode({
      userId: cleaner.id,
      role: 'CLEANER',
      app: 'PRO',
    });
    const row = await prisma.nativeHandoffCode.findFirstOrThrow({ where: { userId: cleaner.id } });
    expect(row.codeHash).not.toBe(code);
    expect(JSON.stringify(row)).not.toContain(code);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(
      handoff.HANDOFF_TTL_S * 1000 + 1000
    );
    const r = await handoff.redeemNativeHandoffCode(code, 'PRO', { label: 'pro-ios/1.0.3' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(await bearerRows(cleaner.id)).toBe(1);
    const bearer = await session.verifyBearerToken(r.token);
    expect(bearer?.id).toBe(cleaner.id);
    expect(await session.verifyAndConsumeBridgeCode(r.bridgeCode)).not.toBeNull();
    expect(await session.verifyAndConsumeBridgeCode(r.bridgeCode)).toBeNull();
    const again = await handoff.redeemNativeHandoffCode(code, 'PRO');
    expect(again).toEqual({ ok: false, reason: 'spent_or_expired' });
    expect(await bearerRows(cleaner.id)).toBe(1);
  });

  it(`H2. two redemptions of one code at once: exactly one wins, exactly one BEARER row (${REPS} reps)`, async () => {
    for (let i = 0; i < REPS; i++) {
      await prisma.deviceSession.deleteMany({ where: { userId: client.id } });
      const code = await handoff.mintNativeHandoffCode({
        userId: client.id,
        role: 'CLIENT',
        app: 'CUSTOMER',
      });
      const results = await Promise.all([
        handoff.redeemNativeHandoffCode(code, 'CUSTOMER'),
        handoff.redeemNativeHandoffCode(code, 'CUSTOMER'),
        handoff.redeemNativeHandoffCode(code, 'CUSTOMER'),
      ]);
      expect(results.filter((x) => x.ok)).toHaveLength(1);
      expect(await bearerRows(client.id)).toBe(1);
    }
  });

  it('H3. app-bound: the other app cannot redeem it and does not consume it; the right app still can', async () => {
    const code = await handoff.mintNativeHandoffCode({
      userId: cleaner.id,
      role: 'CLEANER',
      app: 'PRO',
    });
    expect((await handoff.redeemNativeHandoffCode(code, 'CUSTOMER')).ok).toBe(false);
    expect(await bearerRows(cleaner.id)).toBe(0);
    expect((await handoff.redeemNativeHandoffCode(code, 'PRO')).ok).toBe(true);
  });

  it('H4. expired, unknown and malformed codes are refused with no row minted', async () => {
    const code = await handoff.mintNativeHandoffCode({
      userId: client.id,
      role: 'CLIENT',
      app: 'CUSTOMER',
    });
    const later = new Date(Date.now() + (handoff.HANDOFF_TTL_S + 1) * 1000);
    expect(await handoff.redeemNativeHandoffCode(code, 'CUSTOMER', {}, later)).toEqual({
      ok: false,
      reason: 'spent_or_expired',
    });
    expect(await handoff.redeemNativeHandoffCode('A'.repeat(43), 'CUSTOMER')).toEqual({
      ok: false,
      reason: 'unknown',
    });
    for (const bad of [undefined, null, 42, '', 'short', `${code}x`, '../../etc']) {
      expect(await handoff.redeemNativeHandoffCode(bad, 'CUSTOMER')).toEqual({
        ok: false,
        reason: 'malformed',
      });
    }
    expect(await bearerRows(client.id)).toBe(0);
  });

  it('H5. user- and role-bound, fail closed: a suspended, deleted or re-roled account is refused and the code is spent', async () => {
    for (const data of [
      { isSuspended: true },
      { isDeleted: true },
      { accountStatus: 'DEACTIVATED' as const },
    ]) {
      await prisma.user.update({
        where: { id: cleaner.id },
        data: { accountStatus: 'ACTIVE', isSuspended: false, isDeleted: false },
      });
      const code = await handoff.mintNativeHandoffCode({
        userId: cleaner.id,
        role: 'CLEANER',
        app: 'PRO',
      });
      await prisma.user.update({ where: { id: cleaner.id }, data });
      expect(await handoff.redeemNativeHandoffCode(code, 'PRO')).toEqual({
        ok: false,
        reason: 'account',
      });
      await prisma.user.update({
        where: { id: cleaner.id },
        data: { accountStatus: 'ACTIVE', isSuspended: false, isDeleted: false },
      });
      expect((await handoff.redeemNativeHandoffCode(code, 'PRO')).ok).toBe(false);
    }
    const code = await handoff.mintNativeHandoffCode({
      userId: cleaner.id,
      role: 'CLEANER',
      app: 'PRO',
    });
    await prisma.user.update({ where: { id: cleaner.id }, data: { role: 'CLIENT' } });
    expect(await handoff.redeemNativeHandoffCode(code, 'PRO')).toEqual({
      ok: false,
      reason: 'role',
    });
    expect(await bearerRows(cleaner.id)).toBe(0);
    await expect(
      handoff.mintNativeHandoffCode({ userId: client.id, role: 'CLIENT', app: 'PRO' })
    ).rejects.toThrow(/role does not belong/);
  });

  it('H6. the signup route: a customer-shell signup gets a handoff code and no Bearer; a website signup gets neither and mints no row', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const call = (email: string, headers: Record<string, string>, ip: string) =>
      POST(
        new Request('http://localhost/api/auth/signup', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
          body: JSON.stringify({
            email,
            password: 'Integration-Passw0rd!',
            name: 'Handoff Signup',
            role: 'CLIENT',
          }),
        })
      );
    const shell = await call(
      EMAIL_SIGNUP,
      { 'user-agent': 'Mozilla/5.0 RenaApp/1.0.1', 'x-rena-shell': 'app-ios/1.0.1' },
      '203.0.113.51'
    );
    expect(shell.status).toBe(201);
    const shellBody = (await shell.json()) as Record<string, unknown>;
    expect(typeof shellBody.handoffCode).toBe('string');
    expect(shellBody.token).toBeUndefined();
    expect(shellBody.bridgeCode).toBeUndefined();
    const shellUser = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_SIGNUP } });
    expect(await bearerRows(shellUser.id)).toBe(0);
    const r = await handoff.redeemNativeHandoffCode(shellBody.handoffCode, 'CUSTOMER');
    expect(r.ok).toBe(true);
    expect(await bearerRows(shellUser.id)).toBe(1);

    const web = await call(EMAIL_WEB, { 'user-agent': 'Mozilla/5.0 Safari' }, '203.0.113.52');
    expect(web.status).toBe(201);
    const webBody = (await web.json()) as Record<string, unknown>;
    expect(webBody.handoffCode).toBeUndefined();
    expect(webBody.token).toBeUndefined();
    expect(webBody.bridgeCode).toBeUndefined();
    const webUser = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL_WEB } });
    expect(await bearerRows(webUser.id)).toBe(0);
    expect(await prisma.nativeHandoffCode.count({ where: { userId: webUser.id } })).toBe(0);
  });

  it('H7. the redeem route: the shell signature picks the app, a browser is refused, every refusal is one 400', async () => {
    const { POST } = await import('@/app/api/auth/native-handoff/route');
    const code = await handoff.mintNativeHandoffCode({
      userId: cleaner.id,
      role: 'CLEANER',
      app: 'PRO',
    });
    const call = (headers: Record<string, string>, body: unknown, ip: string) =>
      POST(
        new Request('http://localhost/api/auth/native-handoff', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...headers },
          body: JSON.stringify(body),
        })
      );
    expect(
      (await call({ 'user-agent': 'Mozilla/5.0 Safari' }, { code }, '203.0.113.61')).status
    ).toBe(400);
    expect((await call({ 'x-rena-shell': 'app-ios/1.0.1' }, { code }, '203.0.113.62')).status).toBe(
      400
    );
    const ok = await call({ 'x-rena-shell': 'pro-ios/1.0.3' }, { code }, '203.0.113.63');
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as Record<string, unknown>;
    expect(typeof body.token).toBe('string');
    expect(typeof body.bridgeCode).toBe('string');
    const replay = await call({ 'x-rena-shell': 'pro-ios/1.0.3' }, { code }, '203.0.113.64');
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({
      error: 'This sign-in link has expired. Please sign in.',
    });
  });

  it('H8. the daily sweep deletes expired handoff codes', async () => {
    const dev = await import('./device-session');
    await handoff.mintNativeHandoffCode({ userId: client.id, role: 'CLIENT', app: 'CUSTOMER' });
    await prisma.nativeHandoffCode.updateMany({
      where: { userId: client.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const swept = await dev.sweepSessionRows();
    expect(swept.handoffCodes).toBeGreaterThan(0);
    expect(await prisma.nativeHandoffCode.count({ where: { userId: client.id } })).toBe(0);
  });
});
