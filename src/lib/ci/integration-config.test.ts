import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// RENA-105: the one local command runs every database suite, serially.
const ROOT = join(__dirname, '..', '..', '..');

// Loaded through a non-literal path on purpose: a static import would pull
// the root vitest configs (outside tsconfig's src include) into the type
// check, where vitest.config.ts's oxc option does not type.
type IntegrationConfig = {
  default: {
    test?: { fileParallelism?: boolean; include?: string[]; env?: Record<string, string> };
  };
  INTEGRATION_FLAGS: readonly string[];
};
const configPath = join(ROOT, 'vitest.integration.config.ts');
const load = () => import(/* @vite-ignore */ configPath) as Promise<IntegrationConfig>;

function suites(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return suites(p);
    return n.endsWith('.integration.test.ts') ? [relative(ROOT, p)] : [];
  });
}

describe('vitest.integration.config', () => {
  it('runs one file at a time, and only the integration suites', async () => {
    const config = (await load()).default;
    expect(config.test?.fileParallelism).toBe(false);
    expect(config.test?.include).toEqual(['src/**/*.integration.test.ts']);
  });

  it('enables the flag of every integration suite, and every suite has a flag', async () => {
    const { default: config, INTEGRATION_FLAGS } = await load();
    const env = config.test?.env as Record<string, string>;
    for (const f of INTEGRATION_FLAGS) expect(env[f]).toBe('1');
    for (const file of suites(join(ROOT, 'src'))) {
      const src = readFileSync(join(ROOT, file), 'utf8');
      const flag = /process\.env\.([A-Z_]+_INTEGRATION) === '1'/.exec(src)?.[1];
      expect(flag, file).toBeDefined();
      expect(INTEGRATION_FLAGS, file).toContain(flag);
    }
  });

  it('the npm script uses it', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:integration']).toBe(
      'vitest run --config vitest.integration.config.ts'
    );
  });
});
