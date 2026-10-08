/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import * as L from './lib.mjs';
const [SCRATCH] = process.argv.slice(2);
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const NET =
  '198.' + (19 + Math.floor(Math.random() * 200)) + '.' + Math.floor(Math.random() * 250) + '.';
let ip = 1;
const out = [];
const ops = (...a) =>
  execFileSync('npx', ['tsx', `${SCRATCH}/walk/rig-ops.ts`, ...a], {
    encoding: 'utf8',
    env: process.env,
  })
    .trim()
    .split('\n')
    .pop();
async function applicant(tag) {
  const email = `walk-delta-${tag}-${Date.now()}@integration.invalid`;
  const c = await b.newContext({ extraHTTPHeaders: { 'x-forwarded-for': NET + ip++ } });
  const p = await c.newPage();
  await L.open(p);
  await L.step0(p, email);
  await c.close();
  return db.user.findUnique({ where: { email } });
}
// 1. Warning undelivered chip.
const failing = await applicant('failing');
const delivered = await applicant('delivered');
await db.cleanerApplicationDraft.update({
  where: { userId: failing.id },
  data: { expiryReminderFailures: 2, expiryReminderAttemptAt: new Date() },
});
await db.cleanerApplicationDraft.update({
  where: { userId: delivered.id },
  data: { expiryReminderSentAt: new Date(), expiryReminderFailures: 1 },
});
const admin = await db.user.findFirst({
  where: { email: { startsWith: 'walk-photo-admin-' } },
  orderBy: { createdAt: 'desc' },
});
const ac = await b.newContext({ extraHTTPHeaders: { 'x-forwarded-for': NET + ip++ } });
const ap = await ac.newPage();
await L.login(ap, admin.email);
await ap.goto('http://localhost:3000/admin/cleaners', { waitUntil: 'load' });
await ap.waitForTimeout(3000);
const rowText = async (email) =>
  ap
    .locator('tr', { hasText: email })
    .first()
    .innerText()
    .catch(() => '(row not found)');
out.push(
  `1. admin list, failing warning: ${/Warning undelivered/.test(await rowText(failing.email)) ? 'shows "Warning undelivered"' : 'NO chip'}; delivered warning: ${/Warning undelivered/.test(await rowText(delivered.email)) ? 'chip (wrong)' : 'no chip'}`
);
await ac.close();
// 2. A query parameter cannot open the preview.
const cleaner = await db.user.findFirst({
  where: { email: { startsWith: 'walk-photo-1' } },
  orderBy: { createdAt: 'desc' },
});
const pc = await b.newContext();
const pp = await pc.newPage();
for (const q of ['?preview=1', '?preview=true&admin=1']) {
  await pp.goto(`http://localhost:3000/cleaners/${cleaner.id}${q}`, { waitUntil: 'load' });
  await pp.waitForTimeout(1500);
  out.push(
    `2. logged out ${q} on an unverified cleaner: ${/isn.t taking new customers right now/.test(await pp.evaluate(() => document.body.innerText)) ? 'not available view' : 'PROFILE SHOWN'}`
  );
}
await pc.close();
// 3. Expiry with and without a delivered warning.
const warned = await applicant('warned');
const unwarned = await applicant('unwarned');
ops('age', warned.email);
const past = new Date(Date.now() - 31 * 86400000);
await db.user.update({ where: { id: unwarned.id }, data: { createdAt: past } });
await db.cleanerApplicationDraft.update({
  where: { userId: unwarned.id },
  data: { lastActivityAt: past },
});
const r = ops('sweep');
out.push(
  `3. 31 idle days, sweep ${r}: warning delivered 4 days ago -> ${(await db.user.findUnique({ where: { id: warned.id } })) ? 'kept' : 'removed'}; no warning delivered -> ${(await db.user.findUnique({ where: { id: unwarned.id } })) ? 'kept' : 'removed'}`
);
await b.close();
await db.$disconnect();
console.log(out.join('\n'));
