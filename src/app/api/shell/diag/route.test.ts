import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: () => ({ allowed: true }),
  getClientIp: () => '1.1.1.1',
}));

import { POST } from './route';

// RENA-066: the held diag route logs only the sanctioned performance fields.
describe('POST /api/shell/diag schema', () => {
  let out: string[];
  beforeEach(() => {
    out = [];
    vi.spyOn(console, 'log').mockImplementation((l: string) => void out.push(l));
    vi.stubEnv('NODE_ENV', 'production');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('keeps app, stage, phase, pane, code and ms; drops everything else unread', async () => {
    const body = {
      app: 'pro',
      stage: 'webview_load',
      ms: 812.4,
      phase: 'shell',
      pane: 'today',
      code: -1004,
      description: 'Could not connect for someone@example.test',
      updatesLog: 'native log with a token Bearer xyz',
      hasToken: true,
    };
    const res = await POST(
      new NextRequest('https://www.renacleaning.co.uk/api/shell/diag', {
        method: 'POST',
        headers: { 'x-rena-shell': 'pro-android/1.0.3' },
        body: JSON.stringify(body),
      })
    );
    expect(res.status).toBe(204);
    expect(out).toHaveLength(1);
    const rec = JSON.parse(out[0]);
    expect(rec).toMatchObject({
      scope: 'boot_diag',
      event: 'beacon',
      shell: 'pro-android/1.0.3',
      app: 'pro',
      stage: 'webview_load',
      ms: 812,
      phase: 'shell',
      pane: 'today',
      code: -1004,
      droppedCount: 3,
    });
    expect(out[0]).not.toMatch(/someone|Bearer|native log|hasToken/);
  });
});
