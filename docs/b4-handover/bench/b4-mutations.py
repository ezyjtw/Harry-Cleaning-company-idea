# Mutation bench: each guard removed must turn its test red (bench doctrine).
import subprocess, os, sys
R='/home/user/Harry-Cleaning-company-idea'
env=dict(os.environ, MONEY_LEDGER_INTEGRATION='1', MONEY_LEDGER_REPS='15', DATABASE_URL=os.environ.get('DATABASE_URL', 'postgresql://rena:rena@127.0.0.1:5432/rena_b4_fresh'))
M=[
 ('same-key retry removed (refund slice)','src/lib/services/refund.service.ts',
  "        // One same-key retry: Stripe answers with the original if it landed.\n        refund = await stripe.refunds.create(params, { idempotencyKey: slice.idempotencyKey });",
  "        throw err;", '6a'),
 ('unknown refund not blocking new refunds','src/lib/money/ledger.ts',
  "  if (slices.some((s) => isUnresolved(s.status))) return null;\n  return Math.max(0, chargedPence",
  "  return Math.max(0, chargedPence", '6a'),
 ('finalisation CAS dropped (concurrent finalisers both apply)','src/lib/services/refund.service.ts',
  "      where: { id: recordId, finalizedExecutedPence: finalizedBefore },",
  "      where: { id: recordId },", '1\\.'),
 ('refund allocation original-only (no LIFO top-up)','src/lib/services/refund.service.ts',
  "    chargesLifo(ledger),\n    Math.min(amountPence, remaining),",
  "    chargesLifo(ledger).filter((c) => c.paymentIntentId === booking.stripePaymentIntentId),\n    Math.min(amountPence, remaining),", '3\\.'),
 ('top-up not anchored (one slice on the original)','src/lib/services/transfer.service.ts',
  "    if (chargeId) charges.push({ chargeId, capturedPence: toPence(t.amount), topupRecordId: t.id });",
  "", '5\\.'),
 ('dispute RESOLVED written before money (old status-first)','src/lib/services/dispute-resolution.service.ts',
  "    if (r.recordStatus !== 'SUCCEEDED') {\n      return recordFailure(",
  "    if (false) {\n      return recordFailure(", '7a'),
 ('dispute transition unguarded','src/lib/services/dispute-resolution.service.ts',
  "    if (d.count !== 1 || b.count !== 1) throw new DisputeConflictError();",
  "", '7b'),
 ('shortfall not held','src/lib/services/payment-success.service.ts',
  "    shortfallPence > 0 ? { amountShortfallPence: shortfallPence, transferStatus: 'PAUSED' } : {};",
  "    {};", '8\\.'),
 ('chargeback hold ignored by release','src/lib/money/ledger.ts',
  "  if ((booking.chargebackStatuses ?? []).includes('OPEN')) reasons.push('CHARGEBACK');",
  "", 'N7'),
 ('N9 unknown treated as failed attempt','src/lib/services/recurring-charge.service.ts',
  "        await markChargeUnknown(b.id);\n        // Not 'failed': no pay-now email while the card may have been charged.\n        return 'skipped';",
  "        await failAttempt(b.id, 'unknown');\n        return 'failed';", 'N9'),
 ('transfer unknown re-executed with a new key','src/lib/services/transfer.service.ts',
  "    data: { transferStatus: 'UNKNOWN', transferFailureReason: reason },",
  "    data: { transferStatus: 'UNKNOWN', transferFailureReason: reason, transferAttempt: { increment: 1 } },", '6d'),
]
out=[]
for name,f,old,new,t in M:
    p=os.path.join(R,f); s=open(p).read()
    if old not in s:
        out.append(f'{name}: ANCHOR MISSING'); continue
    open(p,'w').write(s.replace(old,new,1))
    try:
        r=subprocess.run(['npx','vitest','run','src/lib/money/money-ledger.integration.test.ts','-t',t],cwd=R,env=env,capture_output=True,text=True,timeout=600)
        tail=[l for l in r.stdout.splitlines() if 'Tests' in l]
        out.append(f"{name} [test {t}]: {'RED (caught)' if r.returncode!=0 else 'GREEN (NOT caught)'} {tail[-1].strip() if tail else ''}")
    finally:
        open(p,'w').write(s)
print('\n'.join(out))
