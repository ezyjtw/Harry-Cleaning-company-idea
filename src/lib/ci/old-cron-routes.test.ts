import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// B7.2 (RENA-062, RENA-081; approved deviation 1): the two cron-secret routes
// outside the lease are gone. GET /api/cron/rtw-expiry duplicated the daily
// compliance jobs check_rtw_expiry and suspend_expired_rtw_cleaners with no
// documented caller; POST /api/abandonment/send read a lead list that nothing
// writes and POST /api/abandonment/capture wrote nothing (both stubs): James
// retired the abandonment path outright (D-ao), any future abandonment email
// being new product work. The scheduler tick is the one entry.
const ROOT = join(__dirname, '..', '..', '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next') continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('old cron routes (B7.2)', () => {
  it('the route files no longer exist', () => {
    expect(existsSync(join(ROOT, 'src/app/api/cron/rtw-expiry/route.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/app/api/abandonment/send/route.ts'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/app/api/abandonment/capture/route.ts'))).toBe(false);
  });

  it('nothing in src, components or either shell calls them', () => {
    const files = ['src', 'components', 'mobile', 'mobile-customer']
      .map((d) => join(ROOT, d))
      .filter(existsSync)
      .flatMap((d) => walk(d));
    const offenders = files.filter((f) => {
      const text = readFileSync(f, 'utf8');
      return (
        text.includes('cron/rtw-expiry') ||
        text.includes('abandonment/send') ||
        text.includes('abandonment/capture') ||
        text.includes('sendAbandonmentEmail')
      );
    });
    expect(offenders).toEqual([]);
  });

  it('the RTW expiry work still runs under the lease (daily compliance jobs)', () => {
    const src = readFileSync(
      join(ROOT, 'src/lib/services/compliance-scheduler.service.ts'),
      'utf8'
    );
    expect(src).toContain('checkRtwExpiry');
    expect(src).toContain('suspendExpiredRtwCleaners');
  });
});
