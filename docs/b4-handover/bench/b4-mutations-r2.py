import subprocess, os
R='/home/user/Harry-Cleaning-company-idea'
env=dict(os.environ, MONEY_LEDGER_INTEGRATION='1', MONEY_LEDGER_REPS='15', DATABASE_URL=os.environ.get('DATABASE_URL', 'postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh'))
M=[
 ('R3 lease and record lock both dropped',[('src/lib/services/dispute-resolution.service.ts',"  if (lease.count !== 1) {","  if (false) {"),('src/lib/services/refund.service.ts',"  if (locked.count !== 1) {","  if (false) {"),('src/lib/services/refund.service.ts',"    ledger.booking.transferStatus === 'REFUNDING' && (await reversedForRecord(recordId)) > 0;","    true;")],'R3'),
 ('R3 record lock only dropped (lease holds)',[('src/lib/services/refund.service.ts',"  if (locked.count !== 1) {","  if (false) {"),('src/lib/services/refund.service.ts',"    ledger.booking.transferStatus === 'REFUNDING' && (await reversedForRecord(recordId)) > 0;","    true;")],'R3'),
]
out=[]
for name,edits,t in M:
    saved={}
    try:
        for f,old,new in edits:
            p=os.path.join(R,f); s=saved.get(p) or open(p).read(); saved.setdefault(p,s)
            cur=open(p).read(); assert old in cur,(name,old); open(p,'w').write(cur.replace(old,new,1))
        r=subprocess.run(['npx','vitest','run','src/lib/money/money-ledger.integration.test.ts','-t',t],cwd=R,env=env,capture_output=True,text=True,timeout=900)
        tail=[l for l in r.stdout.splitlines() if 'Tests' in l]
        out.append(f"{name} [test {t}]: {'RED (caught)' if r.returncode else 'GREEN (NOT caught)'} {tail[-1].strip() if tail else ''}")
    finally:
        for p,s in saved.items(): open(p,'w').write(s)
print('\n'.join(out))
