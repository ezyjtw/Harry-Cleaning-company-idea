/* eslint-disable no-console */
// F-A backfill: waitlist signups recovered from Railway runtime logs (the old
// /api/waitlist only console-logged them). Railway prunes logs for superseded
// deployments, so only the ACTIVE deployment's window (from 2026-07-15 16:00Z)
// was recoverable — one genuine entry, embedded below with its true timestamp.
// Anything logged before that window is gone from the log store.
//
// Idempotent (upsert on email+postcode; createdAt only set on create).
//
//   railway run npx tsx scripts/backfill-waitlist.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// [WAITLIST] email=harryw84@live.co.uk, postcode=CT1 1FW, ip=92.40.176.34
// logged 2026-07-16T09:44:58Z on deployment 2987ecc2 (source pre-dates the
// source field — the quote widget was the only capture point then).
const RECOVERED = [
  {
    email: 'harryw84@live.co.uk',
    postcode: 'CT1 1FW',
    source: 'quote-widget',
    createdAt: new Date('2026-07-16T09:44:58Z'),
  },
];

async function main() {
  for (const entry of RECOVERED) {
    const row = await prisma.waitlistEntry.upsert({
      where: { email_postcode: { email: entry.email, postcode: entry.postcode } },
      create: entry,
      update: {},
    });
    console.log(`[backfill-waitlist] ${entry.email} ${entry.postcode} -> id=${row.id}`);
  }
  const total = await prisma.waitlistEntry.count();
  console.log(
    `[backfill-waitlist] done — table now holds ${total} entr${total === 1 ? 'y' : 'ies'}`
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
