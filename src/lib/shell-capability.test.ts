import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isCustomerShell,
  isCustomerShellUA,
  isRenaShell,
  isShellUA,
  postSignedUpToShell,
  shellHandoffApp,
  shellHasCapability,
  SIGNED_UP_HANDOFF_CAPABILITY,
} from './shell';

// B5 (James-ruled 8 Oct): the web posts signedUp only to a shell that
// advertises signedUpHandoffV1. Neither the version number nor the bridge
// counts (old shells carry the bridge too). Behavioural negotiation only.
const ROOT = join(__dirname, '..', '..');
const BASE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

/** The UA a shell's own source produces, read from the source itself. */
function shellUA(app: 'mobile' | 'mobile-customer', version: string): string {
  const src = readFileSync(join(ROOT, app, 'App.tsx'), 'utf8');
  const caps = /const SHELL_CAPABILITIES = \[([^\]]*)\];/.exec(src);
  const suffix = /const UA_SUFFIX = `([^`]*)`;/.exec(src);
  if (!caps || !suffix) throw new Error(`${app}: capability or UA_SUFFIX not found`);
  const list = caps[1]
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
  const ua = suffix[1]
    .replace("${Constants.expoConfig?.version ?? '1.0'}", version)
    .replace("${SHELL_CAPABILITIES.join(',')}", list.join(','));
  if (ua.includes('${')) throw new Error(`${app}: unexpected UA_SUFFIX shape`);
  return `${BASE} ${ua}`;
}

const PRO_4 = shellUA('mobile', '1.0.4');
const CUSTOMER_4 = shellUA('mobile-customer', '1.0.2');
const PRO_LEGACY = `${BASE} RenaPro/1.0.3`;
const CUSTOMER_LEGACY = `${BASE} RenaApp/1.0.1`;

function asClient(ua: string, bridge?: (m: string) => void) {
  vi.stubGlobal('navigator', { userAgent: ua });
  vi.stubGlobal('window', bridge ? { ReactNativeWebView: { postMessage: bridge } } : {});
}
afterEach(() => vi.unstubAllGlobals());

describe('shellHasCapability', () => {
  it('the Pro-4 and Customer-4 source advertise signedUpHandoffV1 and stay their own shell', () => {
    asClient(PRO_4);
    expect(shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)).toBe(true);
    expect(isShellUA()).toBe(true);
    expect(isCustomerShellUA()).toBe(false);
    asClient(CUSTOMER_4);
    expect(shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)).toBe(true);
    expect(isCustomerShellUA()).toBe(true);
    expect(isShellUA()).toBe(false);
  });

  it.each([
    ['legacy Pro shell (bridge era, no token)', PRO_LEGACY, false],
    ['legacy customer shell', CUSTOMER_LEGACY, false],
    ['plain browser', 'Mozilla/5.0 (Macintosh) Safari/605.1.15', false],
    ['longer lookalike value', `${PRO_LEGACY} RenaCap/signedUpHandoffV10`, false],
    ['prefixed lookalike value', `${PRO_LEGACY} RenaCap/xsignedUpHandoffV1`, false],
    ['lookalike token name', `${PRO_LEGACY} NotRenaCap/signedUpHandoffV1`, false],
    ['token text elsewhere in the UA', `${PRO_LEGACY} (signedUpHandoffV1)`, false],
    ['one of several capabilities', `${PRO_LEGACY} RenaCap/other,signedUpHandoffV1`, true],
  ])('%s', (_label, ua, want) => {
    asClient(ua);
    expect(shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)).toBe(want);
  });

  it('is false without a navigator (SSR)', () => {
    vi.stubGlobal('navigator', undefined);
    expect(shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)).toBe(false);
  });
});

describe('postSignedUpToShell', () => {
  const msg = { handoffCode: 'code-1', email: 'a@integration.invalid', role: 'CLEANER' as const };

  it('a legacy shell with the bridge is never posted to, so the page never waits', () => {
    for (const ua of [PRO_LEGACY, CUSTOMER_LEGACY]) {
      const posted: string[] = [];
      asClient(ua, (m) => posted.push(m));
      expect(postSignedUpToShell(msg)).toBe(false);
      expect(posted).toEqual([]);
    }
  });

  it('a capable shell is posted to exactly once, with the code and display data only', () => {
    for (const ua of [PRO_4, CUSTOMER_4]) {
      const posted: string[] = [];
      asClient(ua, (m) => posted.push(m));
      expect(postSignedUpToShell(msg)).toBe(true);
      expect(posted).toHaveLength(1);
      const body = JSON.parse(posted[0]) as Record<string, unknown>;
      expect(Object.keys(body).sort()).toEqual(['email', 'handoffCode', 'role', 'type']);
      expect(body.type).toBe('signedUp');
    }
  });

  it('the capability without a bridge posts nothing', () => {
    asClient(PRO_4);
    expect(postSignedUpToShell(msg)).toBe(false);
  });
});

describe('the capability is never authorisation', () => {
  const h = (ua: string) => ({
    get: (n: string) => (n.toLowerCase() === 'user-agent' ? ua : null),
  });

  it('the server gates read the same with the token absent, present or spoofed', () => {
    const spoofed = `Mozilla/5.0 (Macintosh) Safari/605.1.15 RenaCap/${SIGNED_UP_HANDOFF_CAPABILITY}`;
    expect(isRenaShell(h(spoofed))).toBe(false);
    expect(isCustomerShell(h(spoofed))).toBe(false);
    expect(shellHandoffApp(h(spoofed), 'CLEANER')).toBeNull();
    expect(shellHandoffApp(h(spoofed), 'CLIENT')).toBeNull();
    expect(shellHandoffApp(h(PRO_4), 'CLEANER')).toBe(shellHandoffApp(h(PRO_LEGACY), 'CLEANER'));
    expect(shellHandoffApp(h(CUSTOMER_4), 'CLIENT')).toBe(
      shellHandoffApp(h(CUSTOMER_LEGACY), 'CLIENT')
    );
  });

  it('only the client helper and the two client signup pages read the capability', () => {
    const allowed = new Set([
      'src/lib/shell.ts',
      'src/app/[locale]/join/page.tsx',
      'src/app/[locale]/signup/page.tsx',
    ]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) {
          const s = readFileSync(p, 'utf8');
          if (/RenaCap|signedUpHandoffV1|shellHasCapability|SIGNED_UP_HANDOFF_CAPABILITY/.test(s))
            hits.push(relative(ROOT, p));
        }
      }
    };
    walk(join(ROOT, 'src'));
    expect(hits.filter((f) => !allowed.has(f))).toEqual([]);
    for (const f of hits.filter((x) => x.endsWith('page.tsx')))
      expect(readFileSync(join(ROOT, f), 'utf8').startsWith("'use client'")).toBe(true);
  });
});
