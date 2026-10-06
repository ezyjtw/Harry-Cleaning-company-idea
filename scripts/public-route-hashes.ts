/* eslint-disable no-console */
// Hash law tool: hashes every route in the canonical list (docs/public-routes.json)
// served by a running build, incognito (no cookies, plain user agent).
//   npx tsx scripts/public-route-hashes.ts --url http://localhost:3000 [--write out.json] [--compare base.json]
// --compare exits 1 naming every route whose hash differs from the base file.
// Per the law's same-build protocol, compare two builds served on the same rig.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

import { PUBLIC_ROUTES, normaliseForHash } from '../src/lib/ci/public-routes';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const base = arg('url') ?? 'http://localhost:3000';
  const result: Record<string, { status: number; hash: string }> = {};
  for (const route of PUBLIC_ROUTES) {
    const res = await fetch(`${base}${route}`, {
      headers: { 'user-agent': 'Mozilla/5.0' },
      redirect: 'follow',
    });
    const html = await res.text();
    const hash = createHash('sha256').update(normaliseForHash(html)).digest('hex').slice(0, 16);
    result[route] = { status: res.status, hash };
    console.log(`${route} ${res.status} ${hash}`);
  }
  const out = arg('write');
  if (out) writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
  const cmp = arg('compare');
  if (cmp) {
    const prior = JSON.parse(readFileSync(cmp, 'utf8')) as typeof result;
    const changed = PUBLIC_ROUTES.filter((r) => prior[r]?.hash !== result[r].hash);
    if (changed.length) {
      console.error(`Hash law: ${changed.length} route(s) changed: ${changed.join(', ')}`);
      process.exit(1);
    }
    console.log(`Hash law: all ${PUBLIC_ROUTES.length} routes identical to the base.`);
  }
  const failed = PUBLIC_ROUTES.filter((r) => result[r].status !== 200);
  if (failed.length) {
    console.error(`Hash law: route(s) not answering 200: ${failed.join(', ')}`);
    process.exit(1);
  }
}

void main();
