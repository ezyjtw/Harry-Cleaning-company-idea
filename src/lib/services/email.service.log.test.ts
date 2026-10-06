import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// RENA-077: the branch that runs in production when Resend is unconfigured
// logs through the allowlisted logger and never the address, subject or body.
// Same return value as before (true).
vi.mock('@/lib/services/notification-preferences.service', () => ({
  shouldSend: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/lib/api-metering', () => ({ logApiCall: vi.fn() }));
vi.mock('@/lib/db/prisma', () => ({ default: {}, prisma: {} }));

describe('email.service log hygiene (RENA-066, RENA-077)', () => {
  let out: string[];
  beforeEach(() => {
    out = [];
    vi.resetModules();
    vi.stubEnv('RESEND_API_KEY', '');
    for (const m of ['log', 'warn', 'error'] as const) {
      vi.spyOn(console, m).mockImplementation((l: string) => void out.push(String(l)));
    }
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('production with no Resend client: a structured error and FAILURE (James-ruled), nothing identifying', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { sendPasswordReset } = await import('./email.service');
    const ok = await sendPasswordReset('someone@example.test', 'tok_abcdef0123456789');
    expect(ok).toBe(false);
    expect(out).toHaveLength(1);
    const rec = JSON.parse(out[0]);
    expect(rec).toMatchObject({
      level: 'error',
      scope: 'email',
      event: 'not_sent',
      reason: 'provider_unconfigured',
    });
    expect(out[0]).not.toMatch(/someone|example\.test|tok_|Reset|password/i);
  });

  it('development may warn and return true; no address, subject or body either', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const { sendPasswordReset } = await import('./email.service');
    expect(await sendPasswordReset('someone@example.test', 'tok_abcdef0123456789')).toBe(true);
    expect(out.join('\n')).not.toMatch(/someone|tok_|<html|Reset your/i);
    expect(out.join('\n')).toContain('dev_preview');
  });
});
