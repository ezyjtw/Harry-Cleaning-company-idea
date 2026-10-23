# Staging seed gate bench (bench doctrine): each refusal removed, or the
# default mode loosened, must turn the guard test red.
import os, subprocess
R = '/home/user/Harry-Cleaning-company-idea'
G = 'scripts/staging/guard.ts'
T = ['npx', 'vitest', 'run', 'src/lib/ci/staging-seed-guard.test.ts']
M = [
  ('marker not required', "  if (env.RENA_STAGING_SEED !== STAGING_SEED_MARKER)\n", "  if (false)\n"),
  ('any address passes as staging', "  if (!/(^|[.-])staging([.-]|$)/.test(authHost) && authHost !== 'localhost')\n", "  if (false)\n"),
  ('staging matched by containment', "/(^|[.-])staging([.-]|$)/.test(authHost)", "authUrl.includes('staging')"),
  ('production hostname allowed', "    fails.push('a production hostname is configured');", "    void 0;"),
  ('live Stripe key allowed', "    fails.push('a live Stripe key is configured');", "    void 0;"),
  ('any database host allowed', "  if (!(dbHost.endsWith('.railway.internal') || dbHost === '127.0.0.1' || dbHost === 'localhost'))\n", "  if (false)\n"),
  ('production database host allowed', "    fails.push('the production database host is configured');", "    void 0;"),
  ('short password allowed', "(env.STAGING_SEED_PASSWORD ?? '').length < 12", "false"),
  ('unset mode seeds the base', "const m = (raw ?? 'none').trim() || 'none';", "const m = (raw ?? 'base').trim() || 'base';"),
]
out = []
p = os.path.join(R, G); orig = open(p).read()
try:
    for name, old, new in M:
        assert old in orig, name
        open(p, 'w').write(orig.replace(old, new, 1))
        r = subprocess.run(T, cwd=R, capture_output=True, text=True, timeout=300)
        out.append(f"{name}: {'RED (caught)' if r.returncode != 0 else 'NOT CAUGHT'}")
        print(out[-1], flush=True)
finally:
    open(p, 'w').write(orig)
print('\n'.join(out))
