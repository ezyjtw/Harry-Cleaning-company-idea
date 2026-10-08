# B5 capability bench (bench doctrine, James-ruled 8 Oct): the signedUp
# capability gate and the 10 second safety net. Each guard removed must turn
# its test red. Page guards need a production rebuild per mutation, so this
# rebuilds, restarts the rig server, runs the named checks, then restores.
# Run with the rig env sourced (DATABASE_URL, R2 stand-in) and the server on :3000.
import os, subprocess, sys, time, urllib.request
R = '/home/user/Harry-Cleaning-company-idea'
WALK = sys.argv[1]  # the rig walk directory holding cap-walk.mjs and lib.mjs
SHELL = 'src/lib/shell.ts'
JOIN = 'src/app/[locale]/join/page.tsx'
SIGNUP = 'src/app/[locale]/signup/page.tsx'
E2E = 'e2e/b5-handoff.spec.ts'

def unit():
    return ['npx', 'vitest', 'run', 'src/lib/shell-capability.test.ts']
def e2e(grep):
    return ['npx', 'playwright', 'test', E2E, '--reporter=list', '-g', grep]
def walk(cases):
    return ['node', 'cap-walk.mjs', cases]

M = [
  ('gate: posts whenever the bridge exists (the legacy shell waits)', True,
   [(SHELL, "  if (!shellHasCapability(SIGNED_UP_HANDOFF_CAPABILITY)) return false;\n", "")],
   [unit(), walk('ii'), e2e('legacy shell')]),
  ('gate: capability matched by containment', False,
   [(SHELL, "  const m = /(?:^|\\s)RenaCap\\/([A-Za-z0-9,]+)(?:\\s|$)/.exec(navigator.userAgent);\n  return !!m && m[1].split(',').includes(cap);",
     "  return navigator.userAgent.includes(cap);")],
   [unit()]),
  ('net: join page never moves on by itself', True,
   [(JOIN, "    const t = setTimeout(() => router.push('/cleaner'), SIGNED_UP_SAFETY_NET_MS);\n    return () => clearTimeout(t);",
     "    return;")],
   [walk('iv,net')]),
  ('net: signup page never moves on by itself', True,
   [(SIGNUP, "      if (data) void finishOnWebsite(data).catch(() => router.push('/login'));", "      void data;")],
   [e2e('safety net')]),
  ('net: fires early (3 seconds, a premature fallback)', True,
   [(SHELL, "export const SIGNED_UP_SAFETY_NET_MS = 10_000;", "export const SIGNED_UP_SAFETY_NET_MS = 3_000;")],
   [walk('iv'), e2e('no premature fallback')]),
]

def restart():
    subprocess.run(['pkill', '-f', 'next start'])
    subprocess.run(['pkill', '-f', 'next-server'])
    time.sleep(2)
    env = dict(os.environ, R2_ENDPOINT='http://127.0.0.1:9100', CRON_SECRET='rig-only-cron-secret')
    subprocess.Popen(['npm', 'start'], cwd=R, env=env, stdout=open('/dev/null', 'w'), stderr=subprocess.STDOUT, start_new_session=True)
    for _ in range(60):
        try:
            urllib.request.urlopen('http://localhost:3000/api/health', timeout=2); return
        except Exception:
            time.sleep(1)
    raise SystemExit('server did not come back')

def build():
    r = subprocess.run(['npm', 'run', 'build'], cwd=R, capture_output=True, text=True)
    if r.returncode != 0: raise SystemExit('build failed:\n' + r.stdout[-2000:] + r.stderr[-2000:])
    restart()

env = dict(os.environ, PLAYWRIGHT_CHROMIUM_EXECUTABLE='/opt/pw-browsers/chromium')
for f in ('cap-walk.mjs', 'lib.mjs'):
    subprocess.run(['cp', os.path.join(WALK, f), R])
out = []
try:
    for name, rebuild, edits, checks in M:
        orig = {}
        try:
            for f, old, new in edits:
                p = os.path.join(R, f); orig.setdefault(p, open(p).read()); s = open(p).read()
                assert old in s, (name, old); open(p, 'w').write(s.replace(old, new, 1))
            if rebuild: build()
            res = []
            for c in checks:
                r = subprocess.run(c, cwd=R, env=env, capture_output=True, text=True, timeout=600)
                res.append(f"{' '.join(c[-2:]) if c[0] != 'node' else 'walk ' + c[-1]}: {'RED' if r.returncode != 0 else 'GREEN'}")
            caught = all(x.endswith('RED') for x in res)
            out.append(f"{name}: {'RED (caught)' if caught else 'NOT CAUGHT'} [{'; '.join(res)}]")
            print(out[-1], flush=True)
        finally:
            for p, s in orig.items(): open(p, 'w').write(s)
    build()
finally:
    for f in ('cap-walk.mjs', 'lib.mjs'):
        try: os.remove(os.path.join(R, f))
        except FileNotFoundError: pass
print('\n'.join(out))
