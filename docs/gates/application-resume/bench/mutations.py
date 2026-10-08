# Application resume mutation bench (bench doctrine, James-ruled 2026-10-08):
# each ownership, version and finalisation guard removed must turn its test red.
import subprocess, os
R='/home/user/Harry-Cleaning-company-idea'
T='src/lib/cleaner-application/application.integration.test.ts'
env=dict(os.environ, CLEANER_APPLICATION_INTEGRATION='1', CLEANER_APPLICATION_REPS='8')
S='src/lib/cleaner-application/service.ts'
L='src/lib/cleaner-application/lifecycle.ts'
I='src/lib/services/incomplete-signup.service.ts'
M=[
 ('version: save lands without a version match',[(S,"prisma.cleanerApplicationDraft.updateMany({\n    where: { userId, version, status: 'IN_PROGRESS' },","prisma.cleanerApplicationDraft.updateMany({\n    where: { userId, status: 'IN_PROGRESS' },")],'A2'),
 ('version: stale version not refused before the write',[(S,"if (!existing || existing.version !== version)","if (!existing)"),(S,"prisma.cleanerApplicationDraft.updateMany({\n    where: { userId, version, status: 'IN_PROGRESS' },","prisma.cleanerApplicationDraft.updateMany({\n    where: { userId, status: 'IN_PROGRESS' },")],'A3'),
 ('ownership: document readable by any signed-in user',[(S,"if (doc.userId !== requester.id && requester.role !== 'ADMIN') return null;","")],'A4'),
 ('ownership: draft document removable by anyone',[(S,"where: { id: documentId, userId, reviewState: 'DRAFT', isDestroyed: false },","where: { id: documentId, reviewState: 'DRAFT', isDestroyed: false },")],'A4'),
 ('documents: replacement not explicit',[(S,"if (current && current.id !== replaceId)","if (false)")],'A5'),
 ('documents: a PENDING upload counts as stored',[(S,"    where: { userId, reviewState: 'DRAFT', storageState: 'STORED', isDestroyed: false },\n    select: { id: true, documentType: true","    where: { userId, reviewState: 'DRAFT', isDestroyed: false },\n    select: { id: true, documentType: true")],'A7'),
 ('finalise: completeness not checked',[(S,"  if (incomplete)\n","  if (false)\n")],'A8'),
 ('finalise: the draft claim does not gate the transaction',[(S,"if (claimed.count !== 1) throw new FinaliseConflict();","")],'A8'),
 ('reminders: the nudge claim does not require an unset marker',[(L,"        status: 'IN_PROGRESS',\n        inactivityReminderSentAt: null,\n        lastActivityAt: { lte: nudgeDue },","        status: 'IN_PROGRESS',\n        lastActivityAt: { lte: nudgeDue },"),(L,"      inactivityReminderSentAt: null,\n      user: { isDeleted: false","      user: { isDeleted: false")],'A11'),
 ('expiry: account age instead of inactivity',[(I,"        {\n          cleanerApplication: {\n            status: 'IN_PROGRESS',\n            lastActivityAt: { lt: cutoff },\n            expiryReminderSentAt: { not: null, lte: warningWindowEnd },\n          },\n        },\n","        { cleanerApplication: { isNot: null } },\n")],'A12'),
 ('removal: objects not deleted',[(I,"      await deleteObject(d.storagePath);","      void d;")],'A13'),
 ('photo: a failed submit keeps the public photo it wrote',[(S,"if (imageKey && user.image !== imageKey) {","if (false) {")],'A15'),
 ('photo: removal and expiry leave the User.image object',[(I,"if (user.image && !user.image.startsWith('http') && !user.image.startsWith('data:')) {","if (false) {")],'A16'),
 ('warning gate: expiry without a delivered warning',[(I,"            expiryReminderSentAt: { not: null, lte: warningWindowEnd },\n","")],'A17'),
 ('warning gate: expiry without waiting out the window',[(I,"expiryReminderSentAt: { not: null, lte: warningWindowEnd },","expiryReminderSentAt: { not: null },")],'A17'),
 ('warning gate: marked sent before delivery',[(L,"data: { expiryReminderAttemptAt: now },","data: { expiryReminderAttemptAt: now, expiryReminderSentAt: now },")],'A17'),
 ('warning gate: no once-a-day retry limit',[(L,"    OR: [{ expiryReminderAttemptAt: null }, { expiryReminderAttemptAt: { lte: retryBefore } }],\n","")],'A17'),
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
