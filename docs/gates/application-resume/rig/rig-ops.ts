/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
// Rig-only helper: runs a service operation the way the app would.
import {
  removeIncompleteSignup,
  sweepIncompleteSignups,
} from '@/lib/services/incomplete-signup.service';
import prisma from '@/lib/db/prisma';
const [op, email] = process.argv.slice(2);
async function main() {
  const u = email ? await prisma.user.findUnique({ where: { email }, select: { id: true } }) : null;
  if (op === 'remove' && u)
    console.log(JSON.stringify(await removeIncompleteSignup({ userId: u.id, actorId: undefined })));
  if (op === 'age' && u) {
    const past = new Date(Date.now() - 31 * 86400000);
    await prisma.user.update({ where: { id: u.id }, data: { createdAt: past } });
    await prisma.cleanerApplicationDraft.update({
      where: { userId: u.id },
      data: { lastActivityAt: past },
    });
    console.log('aged');
  }
  if (op === 'sweep') console.log(JSON.stringify(await sweepIncompleteSignups()));
  await prisma.$disconnect();
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
