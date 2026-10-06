/* eslint-disable no-console */
// RENA-042 (remediation register, B0): CI guard for the version-bump law.
//
// Usage:
//   npx tsx scripts/check-runtime-bump.ts --base origin/main
//
// For each shell (mobile/, mobile-customer/) compares the base ref with HEAD:
// app.json minus the OTA-safe keys, package.json dependencies, and the native
// files (icons, splash art, plugins, google-services.json). Any native change
// without a change to that shell's app.json `version` fails with exit 1.
// The decision lives in src/lib/ci/runtime-bump.ts; this file only reads git.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { evaluateShell, formatVerdict, SHELLS, type Shell } from '../src/lib/ci/runtime-bump';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' });
}

function gitJsonAt(ref: string, file: string): unknown {
  try {
    return JSON.parse(git(['show', `${ref}:${file}`]));
  } catch {
    return null;
  }
}

function headJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function main(): void {
  const base = arg('--base') ?? 'origin/main';
  const mergeBase = git(['merge-base', base, 'HEAD']).trim();
  const changed = git(['diff', '--name-only', `${mergeBase}..HEAD`])
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  let failed = false;
  for (const shell of SHELLS as readonly Shell[]) {
    const touched = changed.some((f) => f.startsWith(`${shell}/`));
    if (!touched) {
      console.log(`${shell}: untouched.`);
      continue;
    }
    const verdict = evaluateShell({
      shell,
      baseAppJson: gitJsonAt(mergeBase, `${shell}/app.json`),
      headAppJson: headJson(`${shell}/app.json`),
      basePackageJson: gitJsonAt(mergeBase, `${shell}/package.json`),
      headPackageJson: headJson(`${shell}/package.json`),
      changedFiles: changed,
    });
    console.log(formatVerdict(verdict));
    if (!verdict.ok) failed = true;
  }

  if (failed) {
    console.error('\nRuntime-bump check FAILED. See CLAUDE.md, EAS Update / OTA (binding).');
    process.exit(1);
  }
  console.log('\nRuntime-bump check passed.');
}

main();
