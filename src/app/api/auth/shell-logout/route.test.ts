import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// D-g device logout: Bearer revokes that BEARER row (children ride the same
// statement in the helper); cookie alone revokes the device through the WEB
// row's parent; garbage is ignored; cookies are always expired.
const revokeSession = vi.fn();
const revokeDeviceByWebSession = vi.fn();
const readBearerJti = vi.fn();
const getToken = vi.fn();

vi.mock('@/lib/auth/device-session', () => ({
  revokeSession: (...a: unknown[]) => revokeSession(...a),
  revokeDeviceByWebSession: (...a: unknown[]) => revokeDeviceByWebSession(...a),
}));
vi.mock('@/lib/auth/session', () => ({ readBearerJti: (...a: unknown[]) => readBearerJti(...a) }));
vi.mock('next-auth/jwt', () => ({ getToken: (...a: unknown[]) => getToken(...a) }));

vi.hoisted(() => {
  process.env.NEXTAUTH_SECRET = 'test-secret';
});

import { POST } from './route';

function post(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('https://www.renacleaning.co.uk/api/auth/shell-logout', {
    method: 'POST',
    headers,
  });
}

describe('POST /api/auth/shell-logout (RENA-007)', () => {
  beforeEach(() => {
    revokeSession.mockReset().mockResolvedValue(1);
    revokeDeviceByWebSession.mockReset().mockResolvedValue(1);
    readBearerJti.mockReset();
    getToken.mockReset().mockResolvedValue(null);
  });

  it('revokes the Bearer session (and its children) when the Bearer is sent', async () => {
    readBearerJti.mockReturnValue('bearer-1');
    const res = await POST(post({ authorization: 'Bearer tok' }));
    expect(res.status).toBe(204);
    expect(revokeSession).toHaveBeenCalledWith('bearer-1', 'logout');
    expect(revokeDeviceByWebSession).not.toHaveBeenCalled();
    expect(res.headers.get('set-cookie')).toContain('next-auth.session-token=');
  });

  it('revokes the device through the cookie when only the cookie is present', async () => {
    getToken.mockResolvedValue({ sid: 'web-7' });
    const res = await POST(post({ cookie: '__Secure-next-auth.session-token=x' }));
    expect(res.status).toBe(204);
    expect(revokeDeviceByWebSession).toHaveBeenCalledWith('web-7', 'logout');
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it('ignores a malformed Bearer and falls back to the cookie', async () => {
    readBearerJti.mockReturnValue(null);
    getToken.mockResolvedValue({ sid: 'web-8' });
    await POST(post({ authorization: 'Bearer garbage' }));
    expect(revokeSession).not.toHaveBeenCalled();
    expect(revokeDeviceByWebSession).toHaveBeenCalledWith('web-8', 'logout');
  });

  it('still answers 204 and expires cookies with nothing to revoke', async () => {
    const res = await POST(post());
    expect(res.status).toBe(204);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(revokeDeviceByWebSession).not.toHaveBeenCalled();
  });
});
