import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CLIENT_NAMESPACES, pickClientMessages } from '@/i18n/client-namespaces';

import en from '../../../messages/en.json';

// RENA-086 (B6.7): the public provider's namespace list equals the set of
// useTranslations namespaces in client components, and every namespace in
// the catalogue is read by someone.
const ROOT = join(__dirname, '..', '..', '..');

function sources(): Array<{ src: string; client: boolean }> {
  const out: Array<{ src: string; client: boolean }> = [];
  const scan = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) scan(p);
      else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) {
        const src = readFileSync(p, 'utf8');
        out.push({ src, client: /^\s*['"]use client['"]/.test(src) });
      }
    }
  };
  for (const d of ['src', 'components']) scan(join(ROOT, d));
  return out;
}

const found = (re: RegExp, files: Array<{ src: string }>) =>
  new Set(files.flatMap((f) => Array.from(f.src.matchAll(re), (m) => m[1])));

describe('client message namespaces', () => {
  it('the provider list equals the client components useTranslations namespaces', () => {
    const files = sources();
    const client = found(
      /useTranslations\(\s*['"](\w+)['"]/g,
      files.filter((f) => f.client)
    );
    expect([...CLIENT_NAMESPACES].sort()).toEqual(Array.from(client).sort());
  });

  it('no component calls useTranslations without a namespace', () => {
    for (const f of sources()) expect(f.src).not.toMatch(/useTranslations\(\s*\)/);
  });

  it('every catalogue namespace is read by a client or server component', () => {
    const files = sources();
    const used = new Set([
      ...Array.from(found(/useTranslations\(\s*['"](\w+)['"]/g, files)),
      ...Array.from(found(/getTranslations\(\s*['"](\w+)['"]/g, files)),
      ...Array.from(found(/namespace:\s*['"](\w+)['"]/g, files)),
    ]);
    for (const ns of Object.keys(en)) expect(used).toContain(ns);
  });

  it('pickClientMessages keeps only the listed namespaces', () => {
    const picked = pickClientMessages(en as Record<string, unknown>);
    expect(Object.keys(picked).sort()).toEqual([...CLIENT_NAMESPACES].sort());
    expect(picked).not.toHaveProperty('Metadata');
  });
});
