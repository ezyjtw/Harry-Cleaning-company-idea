/* eslint-disable */
// Rig-only walk (gate evidence for RENA-103); not product code.
// RENA-103 rig walk: an admin views the dossier of one applicant with a saved
// application (stopped at step 3) and one pre-draft account (no draft row).
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as L from '../application-resume/rig/lib.mjs';
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const NET =
  '198.' + (19 + Math.floor(Math.random() * 200)) + '.' + Math.floor(Math.random() * 250) + '.';
let ip = 1;
const out = [];
const ctx = () => b.newContext({ extraHTTPHeaders: { 'x-forwarded-for': NET + ip++ } });

// 1. A real applicant who stops after step 2 (saved step 3 of 7).
const email = `walk-dossier-draft-${Date.now()}@integration.invalid`;
const c = await ctx();
const p = await c.newPage();
await L.open(p);
await L.step0(p, email);
await L.step1(p);
await p.waitForTimeout(800);
await c.close();
const drafted = await db.user.findUnique({
  where: { email },
  include: { cleanerApplication: true },
});
// 2. A pre-draft account: an old-style step 1 account with no draft row.
const pre = await db.user.create({
  data: {
    email: `walk-dossier-predraft-${Date.now()}@integration.invalid`,
    name: 'Walk Predraft',
    role: 'CLEANER',
    passwordHash: 'x',
  },
});

const admin = await db.user.findFirst({
  where: { email: { startsWith: 'walk-photo-admin-' } },
  orderBy: { createdAt: 'desc' },
});
const ac = await ctx();
const ap = await ac.newPage();
await L.login(ap, admin.email);
for (const [label, u] of [
  ['saved application', drafted],
  ['pre-draft account', pre],
]) {
  await ap.goto(`http://localhost:3000/admin/cleaners/${u.id}`, { waitUntil: 'load' });
  await ap.waitForTimeout(2500);
  const t = (
    await ap
      .locator('[data-testid="incomplete-signup-view"]')
      .innerText()
      .catch(() => '(view missing)')
  ).replace(/\s+/g, ' ');
  const pick = (re) => (t.match(re) || ['(absent)'])[0];
  out.push(
    `${label}: heading "${pick(/Saved application|Wizard progress \(estimate\)/i)}"; ${pick(/Saved step Step \d of 7 · \w+/)}; ${pick(/Furthest step reached:? Step \d of 7 · \w+/)}; ${pick(/Deletion warning (Not sent yet|Delivered [^R]+|Warning undelivered[^R]+)/)}; removal "${pick(/removed automatically [^.]+/)}"; estimate note ${/Estimate: this account started before/.test(t) ? 'shown' : 'not shown'}`
  );
}
out.push(
  `server draft for the saved application: currentStep=${drafted.cleanerApplication?.currentStep} (shown as step ${drafted.cleanerApplication?.currentStep + 1})`
);
await ac.close();
await b.close();
await db.$disconnect();
console.log(out.join('\n'));
process.exit(0);
