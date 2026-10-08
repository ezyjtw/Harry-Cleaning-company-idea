/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as L from './lib.mjs';
const S3 = process.argv[2];
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const out = [];
const PRO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 RenaPro/1.0.3';
let ip = 120;
const ctxOpts = (extra = {}) => ({
  extraHTTPHeaders: { 'x-forwarded-for': '198.18.1.' + ip++ },
  ...extra,
});
const objects = () => {
  const r = [];
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      statSync(p).isDirectory() ? walk(p) : r.push(p.slice(S3.length + 1));
    }
  };
  walk(S3);
  return r;
};
async function server(email) {
  const u = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      cleanerProfile: { select: { id: true } },
      cleanerApplication: { select: { currentStep: true, version: true, status: true } },
    },
  });
  if (!u) return { user: 'none' };
  const docs = await db.documentUpload.findMany({
    where: { userId: u.id, isDestroyed: false },
    select: { documentType: true, storageState: true, reviewState: true, storagePath: true },
  });
  return {
    user: 'exists',
    profile: !!u.cleanerProfile,
    draft: u.cleanerApplication,
    docs: docs.map(
      (d) =>
        `${d.documentType}:${d.storageState}/${d.reviewState}:${objects().some((o) => o.endsWith(d.storagePath)) ? 'object' : 'NO-OBJECT'}`
    ),
  };
}
const STEPS = {
  2: ['step0'],
  5: ['step0', 'step1', 'step2', 'step3'],
  7: ['step0', 'step1', 'step2', 'step3', 'step4', 'step5'],
};
const docUploaded = async (p) => (await L.text(p)).match(/Uploaded|uploaded|✓/g)?.length ?? 0;
const emails = {};
for (const S of [2, 5, 7]) {
  const email = `walk-resume-s${S}-${Date.now()}@integration.invalid`;
  emails[S] = email;
  const ctxA = await b.newContext(ctxOpts());
  const a = await ctxA.newPage();
  await L.open(a);
  for (const s of STEPS[S]) {
    if (s === 'step0') await L.step0(a, email);
    else await L[s](a);
  }
  await a.waitForTimeout(800);
  out.push(`=== Stop at step ${S}: screen says step ${await L.stepLabel(a)}`);
  out.push(`server: ${JSON.stringify(await server(email))}`);
  // Same browser, come back later.
  const a2 = await ctxA.newPage();
  await L.openResume(a2);
  out.push(
    `same browser /join: lands on step ${await L.stepLabel(a2)}; welcome notice=${/Welcome back/.test(await L.text(a2))}`
  );
  await ctxA.close();
  // Fresh browser, logged out.
  const ctxB = await b.newContext(ctxOpts());
  const q = await ctxB.newPage();
  await L.open(q);
  await L.step0(q, email);
  out.push(
    `fresh browser logged out, step 1 with same email: "${((await L.text(q)).match(/You already started an application\. Sign in to continue\./) || ['(message missing)'])[0]}"`
  );
  // The page's own sign-in link (it carries callbackUrl=/join).
  await q.getByRole('link', { name: 'Sign in', exact: true }).click();
  await q.waitForURL(/\/login/);
  await q.locator('input[type=email]').fill(email);
  await q.locator('input[type=password]').first().fill(L.PW);
  await q.locator('form button[type=submit]').first().click();
  await q.waitForTimeout(5000);
  out.push(`after the page's sign in link: lands on ${new URL(q.url()).pathname}`);
  if (!/\/join/.test(q.url())) await L.openResume(q);
  const qt = await L.text(q);
  out.push(
    `fresh browser signed in /join: step ${await L.stepLabel(q)}; password fields shown=${(await q.getByPlaceholder('Min. 8 characters').count()) > 0 ? 'yes' : 'no'}; refusal shown=${/already started/.test(qt)}`
  );
  await q.goto('http://localhost:3000/cleaner', { waitUntil: 'load' });
  await q.waitForTimeout(5000);
  out.push(
    `fresh browser /cleaner: ${new URL(q.url()).pathname}; card="${((await L.text(q)).match(/Finish your application.*?saved\./) || ['(no card)'])[0]}"`
  );
  // Pro shell, same signed-in session.
  const ctxP = await b.newContext(
    ctxOpts({
      userAgent: PRO_UA,
      extraHTTPHeaders: { 'x-rena-shell': 'pro-ios/1.0.3', 'x-forwarded-for': '198.18.1.' + ip++ },
    })
  );
  await ctxP.addCookies(await ctxB.cookies());
  const r = await ctxP.newPage();
  await r.goto('http://localhost:3000/en/app/today', { waitUntil: 'load' });
  await r.waitForTimeout(5000);
  const rt = await L.text(r);
  out.push(
    `Pro shell Today: card="${(rt.match(/Finish your application.*?saved\./) || ['(no card)'])[0]}"; empty jobs state shown=${/Nothing Booked Yet/.test(rt)}`
  );
  await r
    .getByRole('link', { name: 'Continue application' })
    .click()
    .catch(() => {});
  await r.waitForTimeout(3500);
  out.push(
    `Pro shell Continue application: ${new URL(r.url()).pathname} at step ${await L.stepLabel(r)}`
  );
  await ctxB.close();
  await ctxP.close();
}
await b.close();
await db.$disconnect();
console.log(out.join('\n'));
