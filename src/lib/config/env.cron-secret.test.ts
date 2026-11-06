import { afterEach, describe, expect, it, vi } from 'vitest';

// B7.2 (approved deviation 2): CRON_SECRET is required at boot in production
// and optional elsewhere. The schema is evaluated at import, so each case
// loads the module fresh under its NODE_ENV.
async function loadSchemaRequired(nodeEnv: string): Promise<boolean | undefined> {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  const mod = await import('./env');
  const result = mod.validateEnvironment();
  const missing = result.errors.find((e) => e.includes('CRON_SECRET'));
  return missing !== undefined;
}

describe('CRON_SECRET boot requirement (B7.2)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('production without CRON_SECRET is a missing required variable', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(await loadSchemaRequired('production')).toBe(true);
  });

  it('production with CRON_SECRET passes that check', async () => {
    vi.stubEnv('CRON_SECRET', 'test-only-secret');
    expect(await loadSchemaRequired('production')).toBe(false);
  });

  it('the rig (NODE_ENV test) may run without it', async () => {
    vi.stubEnv('CRON_SECRET', '');
    expect(await loadSchemaRequired('test')).toBe(false);
  });
});
