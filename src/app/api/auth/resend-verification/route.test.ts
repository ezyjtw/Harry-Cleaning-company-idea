import { beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-077 with RENA-009 unchanged: the signed-in owner of the address hears
// the truth about the send; everybody else gets the constant message.
const resend = vi.fn();
const getSessionUser = vi.fn();
vi.mock('@/lib/services/auth.service', () => ({
  resendEmailVerification: (...a: unknown[]) => resend(...a),
}));
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: (...a: unknown[]) => getSessionUser(...a),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientIp: () => '1.1.1.1',
}));

import { POST } from './route';

const CONSTANT =
  "If an unverified account exists for that email, we've sent a new verification link.";
const req = (email: string) =>
  new Request('https://www.renacleaning.co.uk/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => {
    resend.mockReset();
    getSessionUser.mockReset();
  });

  it('owner, provider failed: says it was NOT sent', async () => {
    resend.mockResolvedValue('failed');
    getSessionUser.mockResolvedValue({ id: 'u1', email: 'Owner@Example.test' });
    const body = await (await POST(req('owner@example.test'))).json();
    expect(body).toMatchObject({ ok: false, sent: false });
    expect(body.message).toMatch(/couldn't send/);
  });

  it('owner, sent: says sent', async () => {
    resend.mockResolvedValue('sent');
    getSessionUser.mockResolvedValue({ id: 'u1', email: 'owner@example.test' });
    expect(await (await POST(req('owner@example.test'))).json()).toMatchObject({
      ok: true,
      sent: true,
    });
  });

  it('anyone else gets the constant message whatever happened (enumeration decision unchanged)', async () => {
    for (const outcome of ['failed', 'sent', 'not_applicable']) {
      resend.mockResolvedValue(outcome);
      getSessionUser.mockResolvedValue(null);
      const body = await (await POST(req('someone@example.test'))).json();
      expect(body).toEqual({ ok: true, message: CONSTANT });
    }
    getSessionUser.mockResolvedValue({ id: 'u2', email: 'other@example.test' });
    resend.mockResolvedValue('failed');
    expect(await (await POST(req('someone@example.test'))).json()).toEqual({
      ok: true,
      message: CONSTANT,
    });
  });
});
