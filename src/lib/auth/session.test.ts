import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// D-g unit proof with a mocked database: claim shapes, the grandfather cutoff
// with an injected clock, the per-request check's query count (one indexed
// row lookup, no user lookup) and the conditional lastSeenAt write.
const findUniqueSession = vi.fn();
const updateManySession = vi.fn();
const findUniqueUser = vi.fn();
const createSession = vi.fn();
vi.mock('@/lib/db/prisma', () => ({
  default: {
    deviceSession: {
      findUnique: (...a: unknown[]) => findUniqueSession(...a),
      updateMany: (...a: unknown[]) => updateManySession(...a),
      create: (...a: unknown[]) => createSession(...a),
    },
    user: { findUnique: (...a: unknown[]) => findUniqueUser(...a) },
  },
}));
vi.mock('./options', () => ({ authOptions: {} }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));

vi.hoisted(() => {
  process.env.NEXTAUTH_SECRET = 'unit-secret';
});

import { LEGACY_TOKEN_CUTOFF, legacyTokensAccepted } from './device-session';
import { generateApiToken, generateBridgeCode, readBearerJti, verifyBearerToken } from './session';

const SECRET = 'unit-secret';
const user = { id: 'u1', email: 'x@example.test', name: 'X', role: 'CLEANER' };
const activeUser = {
  id: 'u1',
  email: 'x@example.test',
  name: 'X',
  role: 'CLEANER',
  accountStatus: 'ACTIVE',
  isSuspended: false,
  passwordChangedAt: null,
  sessionVersion: 0,
};
const beforeCutoff = new Date(LEGACY_TOKEN_CUTOFF.getTime() - 24 * 60 * 60 * 1000);
const afterCutoff = new Date(LEGACY_TOKEN_CUTOFF.getTime() + 1000);

function legacyBearer(iatS: number): string {
  return jwt.sign({ ...user, iat: iatS }, SECRET, { expiresIn: '30d', issuer: 'rena-cleaning' });
}

describe('legacy cutoff constant', () => {
  it('is fixed, documented and thirty days after the planned deploy', () => {
    expect(LEGACY_TOKEN_CUTOFF.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    expect(legacyTokensAccepted(beforeCutoff)).toBe(true);
    expect(legacyTokensAccepted(afterCutoff)).toBe(false);
    expect(legacyTokensAccepted(LEGACY_TOKEN_CUTOFF)).toBe(false);
  });
});

describe('claims', () => {
  beforeEach(() => {
    findUniqueUser.mockReset().mockResolvedValue({ sessionVersion: 4 });
    createSession.mockReset().mockResolvedValue({});
  });

  it('Bearer carries jti and sv and writes a BEARER row first', async () => {
    const { token, jti } = await generateApiToken(user, { label: 'pro-ios/1.0.3' });
    const payload = jwt.verify(token, SECRET, { issuer: 'rena-cleaning' }) as {
      jti: string;
      sv: number;
    };
    expect(payload.jti).toBe(jti);
    expect(payload.sv).toBe(4);
    expect(createSession).toHaveBeenCalledWith({
      data: expect.objectContaining({
        jti,
        userId: 'u1',
        kind: 'BEARER',
        label: 'pro-ios/1.0.3',
        sv: 4,
      }),
    });
    expect(readBearerJti(token)).toBe(jti);
    expect(readBearerJti('garbage')).toBeNull();
  });

  it('bridge code names its parent Bearer and carries its own jti', () => {
    const code = generateBridgeCode({ id: 'u1', bearerJti: 'bearer-9' });
    const payload = jwt.verify(code, SECRET, { issuer: 'rena-bridge' }) as {
      bjti: string;
      jti: string;
      exp: number;
      iat: number;
    };
    expect(payload.bjti).toBe('bearer-9');
    expect(payload.jti).toMatch(/[0-9a-f-]{36}/);
    expect(payload.exp - payload.iat).toBe(60);
  });
});

describe('verifyBearerToken: grandfathered legacy tokens', () => {
  beforeEach(() => {
    findUniqueUser.mockReset();
    findUniqueSession.mockReset();
  });

  it('accepts a pre-B1a token before the cutoff with a missing sv read as 0', async () => {
    findUniqueUser.mockResolvedValue(activeUser);
    const token = legacyBearer(Math.floor(beforeCutoff.getTime() / 1000) - 60);
    const result = await verifyBearerToken(token, beforeCutoff);
    expect(result?.id).toBe('u1');
    expect(result?.sessionJti).toBeNull();
    expect(findUniqueSession).not.toHaveBeenCalled();
  });

  it('rejects a pre-B1a token once the user version has moved (sign-out-everywhere reaches it)', async () => {
    findUniqueUser.mockResolvedValue({ ...activeUser, sessionVersion: 1 });
    const token = legacyBearer(Math.floor(beforeCutoff.getTime() / 1000) - 60);
    expect(await verifyBearerToken(token, beforeCutoff)).toBeNull();
  });

  it('rejects a pre-B1a token issued before a password change', async () => {
    const iat = Math.floor(beforeCutoff.getTime() / 1000) - 600;
    findUniqueUser.mockResolvedValue({
      ...activeUser,
      passwordChangedAt: new Date(iat * 1000 + 60_000),
    });
    expect(await verifyBearerToken(legacyBearer(iat), beforeCutoff)).toBeNull();
  });

  it('rejects every pre-B1a token after the cutoff without touching the database', async () => {
    findUniqueUser.mockResolvedValue(activeUser);
    const token = legacyBearer(Math.floor(afterCutoff.getTime() / 1000) - 60);
    expect(await verifyBearerToken(token, afterCutoff)).toBeNull();
    expect(findUniqueUser).not.toHaveBeenCalled();
  });
});

describe('verifyBearerToken: tracked tokens', () => {
  const now = new Date('2026-10-20T12:00:00.000Z');
  const row = (overrides: Record<string, unknown> = {}) => ({
    jti: 'j1',
    userId: 'u1',
    kind: 'BEARER',
    sv: 0,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 1000 * 60),
    lastSeenAt: now,
    user: activeUser,
    ...overrides,
  });
  const tracked = (sv = 0) =>
    jwt.sign({ ...user, sv, iat: Math.floor(now.getTime() / 1000) - 10 }, SECRET, {
      expiresIn: '30d',
      issuer: 'rena-cleaning',
      jwtid: 'j1',
    });

  beforeEach(() => {
    findUniqueUser.mockReset();
    findUniqueSession.mockReset();
    updateManySession.mockReset().mockResolvedValue({ count: 1 });
  });

  it('is one indexed session lookup and no user lookup', async () => {
    findUniqueSession.mockResolvedValue(row());
    const result = await verifyBearerToken(tracked(), now);
    expect(result).toEqual({
      id: 'u1',
      email: 'x@example.test',
      name: 'X',
      role: 'CLEANER',
      sessionJti: 'j1',
    });
    expect(findUniqueSession).toHaveBeenCalledTimes(1);
    expect(findUniqueSession.mock.calls[0][0]).toMatchObject({ where: { jti: 'j1' } });
    expect(findUniqueUser).not.toHaveBeenCalled();
    expect(updateManySession).not.toHaveBeenCalled(); // seen just now: no write
  });

  it('writes lastSeenAt only when older than five minutes, conditionally', async () => {
    findUniqueSession.mockResolvedValue(
      row({ lastSeenAt: new Date(now.getTime() - 6 * 60 * 1000) })
    );
    await verifyBearerToken(tracked(), now);
    expect(updateManySession).toHaveBeenCalledTimes(1);
    expect(updateManySession.mock.calls[0][0]).toMatchObject({
      where: { jti: 'j1', lastSeenAt: { lt: expect.any(Date) } },
      data: { lastSeenAt: now },
    });
  });

  it('rejects revoked, expired, wrong-kind, wrong-user, stale-version and post-password-change rows', async () => {
    for (const bad of [
      row({ revokedAt: now }),
      row({ expiresAt: new Date(now.getTime() - 1) }),
      row({ kind: 'WEB' }),
      row({ userId: 'someone-else' }),
      row({ user: { ...activeUser, sessionVersion: 1 } }),
      row({ sv: 1 }),
      row({ user: { ...activeUser, isSuspended: true } }),
      row({ user: { ...activeUser, accountStatus: 'DEACTIVATED' } }),
      row({ user: { ...activeUser, passwordChangedAt: new Date(now.getTime() + 60_000) } }),
      null,
    ]) {
      findUniqueSession.mockResolvedValueOnce(bad);
      expect(await verifyBearerToken(tracked(), now)).toBeNull();
    }
  });

  it('a token whose sv claim lags the row is rejected even when the row matches the user', async () => {
    findUniqueSession.mockResolvedValue(row({ sv: 2, user: { ...activeUser, sessionVersion: 2 } }));
    expect(await verifyBearerToken(tracked(0), now)).toBeNull();
    expect(await verifyBearerToken(tracked(2), now)).not.toBeNull();
  });
});
