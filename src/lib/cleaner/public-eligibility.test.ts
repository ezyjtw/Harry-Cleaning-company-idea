import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { eligibleCleanerWhere } from '@/lib/services/area-search.service';

import { PUBLIC_PROFILE_FLAGS, isPublicProfile, publicProfileWhere } from './public-eligibility';

// RENA-101 (the auditor's condition d): one public-profile rule.
const all = Object.fromEntries(PUBLIC_PROFILE_FLAGS.map((f) => [f, true])) as Parameters<
  typeof isPublicProfile
>[0];

describe('public profile eligibility (RENA-101)', () => {
  it('the directory predicate carries every public-profile flag', () => {
    const where = eligibleCleanerWhere(new Date()) as Record<string, unknown>;
    for (const f of PUBLIC_PROFILE_FLAGS) expect(where[f]).toBe(true);
    expect(publicProfileWhere()).toEqual(all);
  });

  it.each(PUBLIC_PROFILE_FLAGS)('a profile missing %s is not public', (f) => {
    expect(isPublicProfile({ ...all, [f]: false })).toBe(false);
  });

  it('the API and the page read the shared rule, and the preview is session-only', () => {
    const api = readFileSync('src/app/api/cleaners/[id]/route.ts', 'utf8');
    const page = readFileSync('src/app/[locale]/cleaners/[id]/page.tsx', 'utf8');
    expect(api).toContain('...publicProfileWhere()');
    expect(page).toContain('isPublicProfile(profile)');
    expect(page).toContain('getSessionUser()');
    expect(page).not.toMatch(/searchParams\??\.preview/);
  });
});
