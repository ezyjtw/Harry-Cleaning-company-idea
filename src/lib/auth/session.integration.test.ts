import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type PrismaDefault from '@/lib/db/prisma';

import type * as DeviceModule from './device-session';
import type * as SessionModule from './session';

// D-g laws against a real Postgres (register rule 7). Opt-in: runs only when
// AUTH_SESSION_INTEGRATION=1 and DATABASE_URL point at a migrated database
// (the rig, or the CI e2e job's service container). Every row is created and
// removed by the test; no real person is used.
const enabled = process.env.AUTH_SESSION_INTEGRATION === '1' && !!process.env.DATABASE_URL;

describe.skipIf(!enabled)('session laws against Postgres (RENA-003, 007, 074)', () => {
  let prisma: typeof PrismaDefault;
  let dev: typeof DeviceModule;
  let session: typeof SessionModule;
  const EMAIL_A = 'b1a-session-a@integration.invalid';
  const EMAIL_B = 'b1a-session-b@integration.invalid';
  let userA: { id: string; email: string; name: string; role: string };
  let userB: { id: string; email: string; name: string; role: string };

  async function cleanup(): Promise<void> {
    const users = await prisma.user.findMany({
      where: { email: { in: [EMAIL_A, EMAIL_B] } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length) {
      await prisma.deviceSession.deleteMany({ where: { userId: { in: ids } } });
      await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
  }

  beforeAll(async () => {
    process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'integration-secret';
    prisma = (await import('@/lib/db/prisma')).default;
    dev = await import('./device-session');
    session = await import('./session');
    await cleanup();
    const a = await prisma.user.create({
      data: {
        email: EMAIL_A,
        name: 'Session A',
        role: 'CLEANER',
        passwordHash: 'x',
        emailVerified: new Date(),
      },
    });
    const b = await prisma.user.create({
      data: {
        email: EMAIL_B,
        name: 'Session B',
        role: 'CLIENT',
        passwordHash: 'x',
        emailVerified: new Date(),
      },
    });
    userA = { id: a.id, email: a.email, name: a.name || '', role: a.role };
    userB = { id: b.id, email: b.email, name: b.name || '', role: b.role };
  });

  beforeEach(async () => {
    await prisma.deviceSession.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.user.updateMany({
      where: { id: { in: [userA.id, userB.id] } },
      data: { sessionVersion: 0, passwordChangedAt: null },
    });
  });

  afterAll(async () => {
    if (prisma) {
      await cleanup();
      await prisma.$disconnect();
    }
  });

  it('mints a Bearer row and verifies it with one session lookup; measured', async () => {
    const { token, jti } = await session.generateApiToken(userA, { label: 'pro-ios/test' });
    const started = Date.now();
    const result = await session.verifyBearerToken(token);
    const elapsed = Date.now() - started;
    expect(result?.id).toBe(userA.id);
    expect(result?.sessionJti).toBe(jti);
    // eslint-disable-next-line no-console
    console.log(`[measure] verifyBearerToken tracked path: ${elapsed} ms`);
    expect(elapsed).toBeLessThan(500);
  });

  it('two redemptions of one bridge code race: exactly one wins, one WEB child', async () => {
    const { jti } = await session.generateApiToken(userA, { label: 'pro-ios/test' });
    const code = session.generateBridgeCode({ id: userA.id, bearerJti: jti });
    const results = await Promise.all([
      session.verifyAndConsumeBridgeCode(code),
      session.verifyAndConsumeBridgeCode(code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const children = await prisma.deviceSession.findMany({ where: { parentJti: jti } });
    expect(children).toHaveLength(1);
    expect(await session.verifyAndConsumeBridgeCode(code)).toBeNull(); // replay after the fact
    expect(await prisma.bridgeCodeUse.count()).toBeGreaterThan(0);
  });

  it('parent validity law: wrong user, WEB kind, revoked, expired or stale-version parents refuse the code', async () => {
    const { jti: bearerA } = await session.generateApiToken(userA, { label: 't' });
    // Wrong user: a code claiming user B against A's Bearer.
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userB.id, bearerJti: bearerA })
      )
    ).toBeNull();
    // Unknown parent.
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userA.id, bearerJti: 'nope' })
      )
    ).toBeNull();
    // WEB parent.
    const web = await dev.createWebSessionRow({ userId: userA.id, label: 'web' });
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userA.id, bearerJti: web.jti })
      )
    ).toBeNull();
    // Revoked parent.
    await dev.revokeSession(bearerA, 'logout');
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userA.id, bearerJti: bearerA })
      )
    ).toBeNull();
    // Expired parent.
    const { jti: bearerExp } = await session.generateApiToken(userA, { label: 't' });
    await prisma.deviceSession.update({
      where: { jti: bearerExp },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userA.id, bearerJti: bearerExp })
      )
    ).toBeNull();
    // Stale version: minted, then the user's version moved.
    const { jti: bearerStale } = await session.generateApiToken(userA, { label: 't' });
    await prisma.user.update({
      where: { id: userA.id },
      data: { sessionVersion: { increment: 1 } },
    });
    expect(
      await session.verifyAndConsumeBridgeCode(
        session.generateBridgeCode({ id: userA.id, bearerJti: bearerStale })
      )
    ).toBeNull();
    // A refused redemption rolled its claim back together with the parent check (one transaction):
    // the same code is still refused on retry because the parent is still invalid.
  });

  it('hierarchy law: child expiry never exceeds the parent; revoking the parent revokes children atomically; the child never reads its parent', async () => {
    const { jti } = await session.generateApiToken(userA, { label: 't' });
    await prisma.deviceSession.update({
      where: { jti },
      data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const redemption = await session.verifyAndConsumeBridgeCode(
      session.generateBridgeCode({ id: userA.id, bearerJti: jti })
    );
    if (!redemption) throw new Error('redemption expected');
    const parent = await prisma.deviceSession.findUniqueOrThrow({ where: { jti } });
    expect(redemption.expiresAt.getTime()).toBeLessThanOrEqual(parent.expiresAt.getTime());

    // The child is checked on its own row only: flipping the parent's revokedAt
    // by a raw write (not the helper) leaves the child valid, by law.
    await prisma.deviceSession.update({
      where: { jti },
      data: { revokedAt: new Date(), revokedReason: 'raw' },
    });
    const childRow = await prisma.deviceSession.findUniqueOrThrow({
      where: { jti: redemption.webJti },
    });
    expect(childRow.revokedAt).toBeNull();

    // The helper revokes parent and children in one statement.
    await prisma.deviceSession.update({
      where: { jti },
      data: { revokedAt: null, revokedReason: null },
    });
    const count = await dev.revokeSession(jti, 'logout');
    expect(count).toBe(2);
    const rows = await prisma.deviceSession.findMany({
      where: { OR: [{ jti }, { parentJti: jti }] },
    });
    expect(rows.every((r) => r.revokedAt !== null && r.revokedReason === 'logout')).toBe(true);
  });

  it('device logout by cookie alone revokes the bridged device (parent and children), a plain web cookie only itself', async () => {
    const { jti } = await session.generateApiToken(userA, { label: 't' });
    const red = await session.verifyAndConsumeBridgeCode(
      session.generateBridgeCode({ id: userA.id, bearerJti: jti })
    );
    if (!red) throw new Error('redemption expected');
    const plain = await dev.createWebSessionRow({ userId: userA.id, label: 'web' });
    expect(await dev.revokeDeviceByWebSession(red.webJti, 'logout')).toBe(2);
    expect(await dev.revokeDeviceByWebSession(plain.jti, 'logout')).toBe(1);
    const other = await prisma.deviceSession.findUniqueOrThrow({ where: { jti: plain.jti } });
    expect(other.revokedAt).not.toBeNull();
  });

  it('sign out everywhere: version bump kills Bearer, bridged cookie row and web row; a new mint lives; other users untouched', async () => {
    const { token, jti } = await session.generateApiToken(userA, { label: 't' });
    const red = await session.verifyAndConsumeBridgeCode(
      session.generateBridgeCode({ id: userA.id, bearerJti: jti })
    );
    if (!red) throw new Error('redemption expected');
    const web = await dev.createWebSessionRow({ userId: userA.id, label: 'web' });
    const { token: tokenB } = await session.generateApiToken(userB, { label: 't' });

    const result = await dev.revokeAllSessions(userA.id, 'all');
    expect(result.sessionVersion).toBe(1);
    expect(result.revoked).toBe(3);
    expect(await session.verifyBearerToken(token)).toBeNull();
    const rows = await prisma.deviceSession.findMany({
      where: { jti: { in: [red.webJti, web.jti] } },
    });
    expect(rows.every((r) => r.revokedAt !== null)).toBe(true);
    expect((await session.verifyBearerToken(tokenB))?.id).toBe(userB.id);

    const fresh = await session.generateApiToken(userA, { label: 't' });
    expect((await session.verifyBearerToken(fresh.token))?.id).toBe(userA.id);
  });

  it('password change path: stamp plus bump plus revocation in one transaction', async () => {
    const { token } = await session.generateApiToken(userA, { label: 't' });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userA.id }, data: { passwordChangedAt: new Date() } });
      await dev.revokeAllSessionsInTx(tx, userA.id, 'password');
    });
    expect(await session.verifyBearerToken(token)).toBeNull();
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userA.id } });
    expect(u.sessionVersion).toBe(1);
    expect(u.passwordChangedAt).not.toBeNull();
  });

  it('legacy upgrade: one row per cookie jti on repeated reads, sv 0 by law', async () => {
    await dev.upgradeLegacyWebSession({ userId: userA.id, cookieJti: 'cookie-1' });
    await dev.upgradeLegacyWebSession({ userId: userA.id, cookieJti: 'cookie-1' });
    const rows = await prisma.deviceSession.findMany({ where: { userId: userA.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].sv).toBe(0);
    expect(rows[0].jti).toBe('legacy-web:cookie-1');
  });

  it('lastSeenAt is written at most every five minutes, conditionally', async () => {
    const { token, jti } = await session.generateApiToken(userA, { label: 't' });
    const old = new Date(Date.now() - 10 * 60 * 1000);
    await prisma.deviceSession.update({ where: { jti }, data: { lastSeenAt: old } });
    await session.verifyBearerToken(token);
    const after = await prisma.deviceSession.findUniqueOrThrow({ where: { jti } });
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(old.getTime());
    await session.verifyBearerToken(token);
    const again = await prisma.deviceSession.findUniqueOrThrow({ where: { jti } });
    expect(again.lastSeenAt.getTime()).toBe(after.lastSeenAt.getTime());
  });

  it('sweep removes spent codes past expiry and rows ended over thirty days ago', async () => {
    const { jti } = await session.generateApiToken(userA, { label: 't' });
    const code = session.generateBridgeCode({ id: userA.id, bearerJti: jti });
    await session.verifyAndConsumeBridgeCode(code);
    const far = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await prisma.bridgeCodeUse.updateMany({ data: { expiresAt: far } });
    await prisma.deviceSession.updateMany({
      where: { userId: userA.id },
      data: { revokedAt: far },
    });
    const swept = await dev.sweepSessionRows();
    expect(swept.bridgeCodes).toBeGreaterThan(0);
    expect(swept.sessions).toBe(2);
  });
});
