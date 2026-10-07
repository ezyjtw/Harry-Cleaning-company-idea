# Mutation bench for the B4 gate delta (bench doctrine): each guard removed
# must turn its test red. Refreshes the drifted chargeback anchor and adds the
# delta's guards. Run against a dedicated database (never the shared rig).
import subprocess, os
R='/home/user/Harry-Cleaning-company-idea'
INT='src/lib/money/money-ledger.integration.test.ts'
LADDER='src/lib/services/cancellation-ladder.test.ts'
env=dict(os.environ, MONEY_LEDGER_INTEGRATION='1', MONEY_LEDGER_REPS=os.environ.get('MONEY_LEDGER_REPS','15'), DATABASE_URL=os.environ.get('DATABASE_URL', 'postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh'))
RS='src/lib/services/refund.service.ts'
TS='src/lib/services/transfer.service.ts'
SCH='src/lib/services/scheduler.service.ts'
PAY='src/lib/services/payment-success.service.ts'
GUARD=(TS,"  if (await refundMoneyUnsettled(prisma, bookingId)) {","  if (false) {")
FILTER=(SCH,"      refundRecords: { none: refundMoneyUnsettledWhere },\n","")
LATE=(PAY,"          OR: [\n            { status: { in: ['SUCCEEDED', 'PARTIAL', 'PENDING', 'UNKNOWN'] } },\n            refundMoneyUnsettledWhere,\n          ],","          OR: [\n            { status: { in: ['SUCCEEDED', 'PARTIAL', 'PENDING', 'UNKNOWN'] } },\n          ],")
CAS1=(RS,"        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null, attempt: rec.attempt },","        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null },")
CAS2=(RS,"        if (b.count !== 1) throw new ClaimMissed();\n        return true;","        return true;")
KEY=(RS,"        idempotencyKey: `reversal_${recordId}_${slice.id}_v${attempt}`,","        idempotencyKey: `reversal_${recordId}_${slice.id}_v${attempt}_${Math.random()}`,")
PRE=(RS,"  if (already.some((r) => r.status === 'UNKNOWN' || r.status === 'PENDING')) {","  if (false) {")
M=[
 # Refreshed anchor (drifted since the first run).
 ('chargeback hold ignored by release',[('src/lib/money/ledger.ts',"st === 'OPEN' || st === 'LOST'","false")],INT,'N7'),
 # Delta 1: dashboard refunds.
 ('dashboard apply CAS: attempt compare dropped',[(RS,"        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null, attempt: rec.attempt },","        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null },")],INT,'D4'),
 ('dashboard apply CAS: attempt and booking claim both dropped',[(RS,"        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null, attempt: rec.attempt },","        const r1 = await tx.refundRecord.updateMany({\n          where: { id: recordId, finalizedAt: null },"),(RS,"        if (b.count !== 1) throw new ClaimMissed();\n        return true;","        return true;")],INT,'D4'),
 ('applied basis replaced by executed basis (the old order dependence)',[(RS,"    select: { context: true, finalizedExecutedPence: true },\n  });\n  const applied = records.reduce((sum, r) => {\n    const c = r.context as { finalizedShareablePence?: number } | null;\n    return sum + (c ? (c.finalizedShareablePence ?? 0) : r.finalizedExecutedPence);\n  }, 0);","    select: { context: true, finalizedExecutedPence: true, executedPence: true },\n  });\n  const applied = records.reduce((sum, r) => sum + r.executedPence, 0);")],INT,'D5'),
 # Delta 2: top-up recovery.
 ('top-up recovery never runs on a confirmed refund',[(RS,"  if (status === 'SUCCEEDED' && ctx.flaggedTopupRecordId) {","  if (false) {")],INT,'T1'),
 ('top-up recovery never runs (cascade-sourced)',[(RS,"  if (status === 'SUCCEEDED' && ctx.flaggedTopupRecordId) {","  if (false) {")],INT,'T4\\.'),
 ('top-up recovery never runs (unknown first, reconciled later)',[(RS,"  if (status === 'SUCCEEDED' && ctx.flaggedTopupRecordId) {","  if (false) {")],INT,'T5'),
 ('top-up recovery runs without Stripe confirmation',[(RS,"  if (!rec || rec.status !== 'SUCCEEDED') return;\n  const t = await prisma.topupRecord.findUnique({ where: { id: topupId } });","  if (!rec) return;\n  const t = await prisma.topupRecord.findUnique({ where: { id: topupId } });")],INT,'T5'),
 # Delta 3: the ladder.
 ('Flexible anchor reverted to 00:00 London',[('src/lib/time/booking-time.ts',"export const CANCELLATION_FLEXIBLE_ANCHOR_HOUR = 6;","export const CANCELLATION_FLEXIBLE_ANCHOR_HOUR = 0;")],LADDER,''),
 # Delta 4: no tolerance.
 ('1p tolerance restored (refund service)',[(RS,"  if (amountPence > remaining) {","  if (amountPence > remaining + 1) {")],INT,'P1'),
 ('1p tolerance restored (dispute split; expected equivalent: the split-of-whole check refuses >= remainder first)',[('src/lib/services/dispute-resolution.service.ts',"    if (amountPence > remainderPence) {","    if (amountPence > remainderPence + 1) {")],INT,'P1'),
 # Delta 5: accept shortfall.
 ('shortfall hold lifts with no acceptance',[('src/lib/money/ledger.ts',"  if ((booking.amountShortfallPence ?? 0) > 0 && !booking.shortfallAccepted) {","  if (false) {")],INT,'8\\.'),
 ('shortfall acceptance takes no reason',[('src/lib/services/money-holds.service.ts',"  if (why.length < 5) return","  if (false) return")],INT,'8\\.'),
 # Delta 6: the never-guess guard on payouts.
 ('item 6: release guard and batch filter both removed',[GUARD,FILTER],INT,'S1'),
 ('item 6: release guard alone removed (batch filter kept)',[GUARD],INT,'S1'),
 ('item 6: batch filter alone removed (release guard kept)',[FILTER],INT,'S1'),
 ('item 6: late-payment unsettled clause reverted',[LATE],INT,'S1'),
 # Follow-ups for the greens above: a guard defended twice is proven as a set.
 ('item 6: batch filter alone removed, crowd-out test',[FILTER],INT,'S2'),
 ('dashboard apply: reversal key unique per call alone (both CAS kept)',[KEY],INT,'D4'),
 ('dashboard apply: attempt CAS, booking claim and reversal key all dropped',[CAS1,CAS2,KEY],INT,'D4'),
 ('dashboard apply CAS: attempt compare dropped, two appliers of one record',[CAS1],INT,'D6'),
 ('dashboard apply CAS: attempt compare and booking claim dropped, two appliers',[CAS1,CAS2],INT,'D6'),
 ('dashboard apply: attempt CAS, booking claim and reversal key all dropped, two appliers',[CAS1,CAS2,KEY],INT,'D6'),
 ('dashboard apply: attempt CAS, booking claim, reversal key and the in-flight reversal pre-check all dropped',[CAS1,CAS2,KEY,PRE],INT,'D6'),
 ('top-up recovery: inner confirmation check dropped and the recovery called before the unknown-outcome return',[(RS,"  if (!rec || rec.status !== 'SUCCEEDED') return;\n  const t = await prisma.topupRecord.findUnique({ where: { id: topupId } });","  if (!rec) return;\n  const t = await prisma.topupRecord.findUnique({ where: { id: topupId } });"),(RS,"  if (status === 'PENDING' || status === 'UNKNOWN') {\n    // The claim stays REFUNDING;","  if (ctx.flaggedTopupRecordId) await completeFlaggedTopupRefund(recordId, ctx);\n  if (status === 'PENDING' || status === 'UNKNOWN') {\n    // The claim stays REFUNDING;")],INT,'T5'),
]
out=[]
ONLY=os.environ.get('ONLY')
for name,edits,tf,t in (M[int(ONLY):] if ONLY else M):
    orig={}
    try:
        missing=False
        for f,old,new in edits:
            p=os.path.join(R,f)
            if p not in orig: orig[p]=open(p).read()
            s=open(p).read()
            if old not in s: missing=True; break
            open(p,'w').write(s.replace(old,new,1))
        if missing:
            out.append(f'{name}: ANCHOR MISSING'); continue
        cmd=['npx','vitest','run',tf]+(['-t',t] if t else [])
        r=subprocess.run(cmd,cwd=R,env=env,capture_output=True,text=True,timeout=900)
        tail=[l for l in r.stdout.splitlines() if 'Tests' in l]
        out.append(f"{name} [test {t or tf}]: {'RED (caught)' if r.returncode!=0 else 'GREEN (NOT caught)'} {tail[-1].strip() if tail else ''}")
    finally:
        for p,s in orig.items(): open(p,'w').write(s)
print('\n'.join(out))
