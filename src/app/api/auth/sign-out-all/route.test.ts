import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionUser = vi.fn();
const revokeAllSessions = vi.fn();
const log = vi.fn();
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: (...a: unknown[]) => getSessionUser(...a),
}));
vi.mock('@/lib/auth/device-session', () => ({
  revokeAllSessions: (...a: unknown[]) => revokeAllSessions(...a),
}));
vi.mock('@/lib/services/audit.service', () => ({
  AuditService: { log: (...a: unknown[]) => log(...a) },
}));

import { POST } from './route';

describe('POST /api/auth/sign-out-all (RENA-007)', () => {
  beforeEach(() => {
    getSessionUser.mockReset();
    revokeAllSessions.mockReset().mockResolvedValue({ sessionVersion: 3, revoked: 4 });
    log.mockReset().mockResolvedValue(undefined);
  });

  it('401 without a session and nothing revoked', async () => {
    getSessionUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(revokeAllSessions).not.toHaveBeenCalled();
  });

  it('revokes every row for the user, current device included, and expires cookies', async () => {
    getSessionUser.mockResolvedValue({ id: 'u1', role: 'CLIENT', sessionJti: 'this-one' });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(revokeAllSessions).toHaveBeenCalledWith('u1', 'all');
    expect(await res.json()).toEqual({ success: true, revoked: 4 });
    expect(res.headers.get('set-cookie')).toContain('next-auth.session-token=');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ action: 'SIGN_OUT_EVERYWHERE' }));
  });
});
