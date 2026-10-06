// RENA-042 (remediation register, B0): the version-bump law, checked by CI.
//
// Both shells use the `appVersion` runtime policy, so an OTA update only
// reaches binaries whose app.json `version` matches. Any change that alters
// the native binary (a dependency, a config plugin, a permission, an
// entitlement, icon or splash art, a scheme or intent filter,
// google-services.json, notification configuration) must therefore ship with a
// version bump and fresh binaries, or an OTA published later against the
// unchanged version would land shell JS that assumes natives the installed
// binary does not have. This module is the pure decision; the CLI in
// scripts/check-runtime-bump.ts feeds it git content.

export const SHELLS = ['mobile', 'mobile-customer'] as const;
export type Shell = (typeof SHELLS)[number];

export interface ShellInputs {
  shell: Shell;
  /** Parsed app.json at the base ref, or null when the file did not exist. */
  baseAppJson: unknown;
  /** Parsed app.json at the head ref, or null when the file does not exist. */
  headAppJson: unknown;
  basePackageJson: unknown;
  headPackageJson: unknown;
  /** Paths changed between base and head, repository-relative. */
  changedFiles: string[];
}

export interface ShellVerdict {
  shell: Shell;
  nativeReasons: string[];
  baseVersion: string | null;
  headVersion: string | null;
  versionChanged: boolean;
  ok: boolean;
}

type Json = Record<string, unknown>;

function asObject(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {};
}

function expoConfig(appJson: unknown): Json {
  const root = asObject(appJson);
  return asObject(root.expo ?? root);
}

/** app.json keys that never change the native binary. */
const OTA_SAFE_APP_KEYS = new Set(['version', 'extra', 'updates', 'runtimeVersion']);

/**
 * The part of app.json that the native build reads. Everything except the
 * OTA-safe keys. Compared structurally, so key order does not matter.
 */
export function nativeView(appJson: unknown): Json {
  const cfg = expoConfig(appJson);
  const view: Json = {};
  for (const [key, value] of Object.entries(cfg)) {
    if (!OTA_SAFE_APP_KEYS.has(key)) view[key] = value;
  }
  return view;
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Json;
    const keys = Object.keys(obj).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function dependencyMap(packageJson: unknown): Record<string, string> {
  const pkg = asObject(packageJson);
  const deps = asObject(pkg.dependencies);
  const out: Record<string, string> = {};
  for (const [name, range] of Object.entries(deps)) out[name] = String(range);
  return out;
}

function dependencyDiff(base: unknown, head: unknown): string[] {
  const a = dependencyMap(base);
  const b = dependencyMap(head);
  const reasons: string[] = [];
  for (const name of Array.from(new Set([...Object.keys(a), ...Object.keys(b)]))) {
    if (!(name in a)) reasons.push(`dependency added: ${name}@${b[name]}`);
    else if (!(name in b)) reasons.push(`dependency removed: ${name}`);
    else if (a[name] !== b[name])
      reasons.push(`dependency changed: ${name} ${a[name]} -> ${b[name]}`);
  }
  return reasons.sort();
}

/**
 * Files under the shell whose change alters the native binary. Fonts are
 * JS-bundled assets (expo-font) and ride OTA; icons, splash art and the
 * adaptive icon are baked into the binary by prebuild; google-services.json
 * and config plugins are read at prebuild.
 */
export function isNativeFile(shell: Shell, path: string): boolean {
  if (!path.startsWith(`${shell}/`)) return false;
  const rel = path.slice(shell.length + 1);
  if (rel === 'google-services.json') return true;
  if (rel === 'GoogleService-Info.plist') return true;
  if (rel.startsWith('plugins/')) return true;
  if (rel.startsWith('assets/')) {
    if (rel.startsWith('assets/fonts/')) return false;
    if (rel.endsWith('.md')) return false;
    return true;
  }
  return false;
}

export function evaluateShell(input: ShellInputs): ShellVerdict {
  const reasons: string[] = [];

  const baseView = stableStringify(nativeView(input.baseAppJson));
  const headView = stableStringify(nativeView(input.headAppJson));
  if (baseView !== headView) {
    const baseCfg = nativeView(input.baseAppJson);
    const headCfg = nativeView(input.headAppJson);
    const keys = new Set([...Object.keys(baseCfg), ...Object.keys(headCfg)]);
    for (const key of Array.from(keys).sort()) {
      if (stableStringify(baseCfg[key]) !== stableStringify(headCfg[key])) {
        reasons.push(`app.json native key changed: ${key}`);
      }
    }
  }

  reasons.push(...dependencyDiff(input.basePackageJson, input.headPackageJson));

  for (const file of [...input.changedFiles].sort()) {
    if (isNativeFile(input.shell, file)) reasons.push(`native file changed: ${file}`);
  }

  const baseVersion = (expoConfig(input.baseAppJson).version as string | undefined) ?? null;
  const headVersion = (expoConfig(input.headAppJson).version as string | undefined) ?? null;
  const versionChanged = baseVersion !== headVersion;

  return {
    shell: input.shell,
    nativeReasons: reasons,
    baseVersion,
    headVersion,
    versionChanged,
    ok: reasons.length === 0 || versionChanged,
  };
}

export function formatVerdict(v: ShellVerdict): string {
  if (v.nativeReasons.length === 0) {
    return `${v.shell}: no native change (version ${v.headVersion ?? 'none'}).`;
  }
  const head = v.ok
    ? `${v.shell}: native change with version bump ${v.baseVersion} -> ${v.headVersion}. OK.`
    : `${v.shell}: NATIVE CHANGE WITHOUT A VERSION BUMP (version stays ${v.headVersion}). Bump app.json version and cut fresh binaries before any OTA (CLAUDE.md, EAS Update / OTA).`;
  return [head, ...v.nativeReasons.map((r) => `  - ${r}`)].join('\n');
}
