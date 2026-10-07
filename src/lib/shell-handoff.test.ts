import { describe, expect, it } from 'vitest';

import { shellHandoffApp } from './shell';

// B5 (RENA-031/082): who a signup response may offer a handoff code to. The
// customer shell for a CLIENT, the Pro shell for a CLEANER, nobody else.
const h = (v: Record<string, string>) => ({ get: (n: string) => v[n.toLowerCase()] ?? null });

describe('shellHandoffApp', () => {
  it.each([
    ['customer shell header, CLIENT', { 'x-rena-shell': 'app-ios/1.0.1' }, 'CLIENT', 'CUSTOMER'],
    [
      'customer shell UA, CLIENT',
      { 'user-agent': 'Mozilla/5.0 RenaApp/1.0.1' },
      'CLIENT',
      'CUSTOMER',
    ],
    ['Pro shell header, CLEANER', { 'x-rena-shell': 'pro-android/1.0.3' }, 'CLEANER', 'PRO'],
    ['Pro shell UA, CLEANER', { 'user-agent': 'Mozilla/5.0 RenaPro/1.0.3' }, 'CLEANER', 'PRO'],
    ['website, CLIENT', { 'user-agent': 'Mozilla/5.0 Safari' }, 'CLIENT', null],
    ['website, CLEANER', { 'user-agent': 'Mozilla/5.0 Safari' }, 'CLEANER', null],
    ['customer shell, CLEANER (wrong app)', { 'x-rena-shell': 'app-ios/1.0.1' }, 'CLEANER', null],
    ['Pro shell, CLIENT (wrong app)', { 'x-rena-shell': 'pro-ios/1.0.3' }, 'CLIENT', null],
    ['any shell, ADMIN', { 'x-rena-shell': 'pro-ios/1.0.3' }, 'ADMIN', null],
    ['lookalike header value', { 'x-rena-shell': 'notpro-ios/1' }, 'CLEANER', null],
  ] as const)('%s', (_label, headers, role, want) => {
    expect(shellHandoffApp(h(headers), role)).toBe(want);
  });
});
