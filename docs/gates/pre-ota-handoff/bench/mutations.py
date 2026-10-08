# Pre-OTA handoff gate bench (bench doctrine; D-ai item 5 and RENA-103):
# each guard removed must turn its test red. nav.ts mutations are applied to
# BOTH shells identically, so the byte-identical core test cannot be what
# catches them. Run with the rig env sourced (DATABASE_URL) for the A21 entry.
import os, subprocess
R = '/home/user/Harry-Cleaning-company-idea'
NAV = ['mobile/nav.ts', 'mobile-customer/nav.ts']
APP = ['mobile/App.tsx', 'mobile-customer/App.tsx']
D = 'src/lib/cleaner-application/dossier.ts'
NAVT = ['npx', 'vitest', 'run', 'src/lib/ci/shell-nav.test.ts']
DOST = ['npx', 'vitest', 'run', 'src/lib/cleaner-application/dossier.test.ts']
A21 = ['npx', 'vitest', 'run', 'src/lib/cleaner-application/application.integration.test.ts', '-t', 'A21']
env = dict(os.environ, CLEANER_APPLICATION_INTEGRATION='1')

redeeming = "      // A portal landing and a second signedUp are both ignored here.\n      return stay;"
M = [
  ('state: a portal landing while REDEEMING falls back to native login',
   [(f, redeeming, "      if (event.type === 'portalLanding')\n        return { state: { ...state, phase: 'FAILED' }, effect: 'nativeLogin' };\n" + redeeming) for f in NAV], [NAVT]),
  ('state: a second signedUp redeems again',
   [(f, redeeming, "      if (event.type === 'signedUp') return { state, effect: 'redeem' };\n" + redeeming) for f in NAV], [NAVT]),
  ('state: a refused or expired code is not sent to native login',
   [(f, "      if (event.type === 'refused')\n        return { state: { ...state, phase: 'FAILED' }, effect: 'nativeLogin' };\n", "") for f in NAV], [NAVT]),
  ('shells: the native redemption runs without the state saying redeem',
   [(f, "if (stepHandoff({ type: 'signedUp', email: msg.email }) !== 'redeem') return;", "stepHandoff({ type: 'signedUp', email: msg.email });") for f in APP], [NAVT]),
  ('shells: a new join or signup does not start from IDLE',
   [(f, "    handoff.current = INITIAL_HANDOFF;\n", "") for f in APP], [NAVT]),
  ('dossier: removal date ignores the warning window',
   [(D, "          draft.expiryReminderSentAt.getTime() + rule.warningWindowDays * DAY_MS\n", "          0\n")], [DOST, A21]),
  ('dossier: a date is promised before any warning was delivered',
   [(D, "  const removal = draft.expiryReminderSentAt\n", "  const removal = true\n"),
    (D, "          draft.expiryReminderSentAt.getTime() + rule.warningWindowDays * DAY_MS\n", "          (draft.expiryReminderSentAt?.getTime() ?? 0) + rule.warningWindowDays * DAY_MS\n")], [DOST, A21]),
  ('dossier: the saved step shown zero-based',
   [(D, "const toStep = (i: number) => Math.min(STEP_COUNT, Math.max(1, Math.floor(i) + 1));",
        "const toStep = (i: number) => Math.min(STEP_COUNT, Math.max(0, Math.floor(i)));")], [DOST, A21]),
]
out = []
for name, edits, checks in M:
    orig = {}
    try:
        for f, old, new in edits:
            p = os.path.join(R, f); orig.setdefault(p, open(p).read()); s = open(p).read()
            assert old in s, (name, f, old); open(p, 'w').write(s.replace(old, new, 1))
        res = []
        for c in checks:
            r = subprocess.run(c, cwd=R, env=env, capture_output=True, text=True, timeout=600)
            res.append(f"{os.path.basename(c[3])}{' A21' if 'A21' in c else ''}: {'RED' if r.returncode != 0 else 'GREEN'}")
        caught = all(x.endswith('RED') for x in res)
        out.append(f"{name}: {'RED (caught)' if caught else 'NOT CAUGHT'} [{'; '.join(res)}]")
        print(out[-1], flush=True)
    finally:
        for p, s in orig.items(): open(p, 'w').write(s)
print('\n'.join(out))
