# B5 handoff mutation bench (bench doctrine): each guard removed must turn its test red.
import subprocess, os
R='/home/user/Harry-Cleaning-company-idea'
T='src/lib/auth/native-handoff.integration.test.ts'
env=dict(os.environ, NATIVE_HANDOFF_INTEGRATION='1', NATIVE_HANDOFF_REPS='15',
         DATABASE_URL=os.environ.get('DATABASE_URL','postgresql://rena:rena@127.0.0.1:5432/rena_b5'))
H='src/lib/auth/native-handoff.ts'
M=[
 ('single-use claim dropped (usedAt not compared)',[(H,"where: { codeHash, app, usedAt: null, expiresAt: { gt: now } },","where: { codeHash, app, expiresAt: { gt: now } },")],'H1|H2'),
 ('app binding dropped',[(H,"where: { codeHash, app, usedAt: null, expiresAt: { gt: now } },","where: { codeHash, usedAt: null, expiresAt: { gt: now } },")],'H3'),
 ('expiry not compared',[(H,"where: { codeHash, app, usedAt: null, expiresAt: { gt: now } },","where: { codeHash, app, usedAt: null },")],'H4'),
 ('account checks dropped',[(H,"if (u.accountStatus !== 'ACTIVE' || u.isSuspended || u.isDeleted) {","if (false) {")],'H5'),
 ('role binding dropped',[(H,"if (u.role !== row.role || APP_ROLE[app] !== row.role) {","if (false) {")],'H5'),
 ('website offered a code (shell gate dropped)',[('src/lib/shell.ts',"if (role === 'CLIENT' && isCustomerShell(headers)) return 'CUSTOMER';","if (role === 'CLIENT') return 'CUSTOMER';")],'H6'),
 ('redeem route trusts any caller as Pro',[('src/app/api/auth/native-handoff/route.ts',"  if (!app) {","  if (false) {")],'H7'),
]
out=[]
for name,edits,t in M:
    orig={}
    try:
        for f,old,new in edits:
            p=os.path.join(R,f); orig.setdefault(p,open(p).read()); s=open(p).read()
            assert old in s,(name,old); open(p,'w').write(s.replace(old,new,1))
        r=subprocess.run(['npx','vitest','run',T,'-t',t],cwd=R,env=env,capture_output=True,text=True,timeout=900)
        tail=[l for l in r.stdout.splitlines() if 'Tests' in l]
        out.append(f"{name} [test {t}]: {'RED (caught)' if r.returncode!=0 else 'GREEN (NOT caught)'} {tail[-1].strip() if tail else ''}")
    finally:
        for p,s in orig.items(): open(p,'w').write(s)
print('\n'.join(out))
