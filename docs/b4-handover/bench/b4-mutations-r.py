import subprocess, os
R='/home/user/Harry-Cleaning-company-idea'
env=dict(os.environ, MONEY_LEDGER_INTEGRATION='1', MONEY_LEDGER_REPS='15', DATABASE_URL=os.environ.get('DATABASE_URL', 'postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh'))
M=[
 ('R1 record lock dropped and REFUNDING always claimable',[('src/lib/services/refund.service.ts',"  if (locked.count !== 1) {","  if (false) {"),('src/lib/services/refund.service.ts',"    ledger.booking.transferStatus === 'REFUNDING' && (await reversedForRecord(recordId)) > 0;","    true;")],'R1'),
 ('R2 lost chargeback not a hold',[('src/lib/money/ledger.ts',"st === 'OPEN' || st === 'LOST'","st === 'OPEN'")],'R2'),
 ('R3 dispute lease dropped',[('src/lib/services/dispute-resolution.service.ts',"  if (lease.count !== 1) {","  if (false) {")],'R3'),
 ('R5 paused-no-hold row dropped',[('src/lib/money/abnormal-states.ts',"    if (b.transferStatus === 'PAUSED' && holds.length === 0) {","    if (false) {")],'R4 and R5'),
 ('R7 payout stop dropped',[('src/lib/services/refund.service.ts',"  if (!state.unresolved && state.paymentStatus === 'REFUNDED') {","  if (false) {")],'R7'),
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
