/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { execFileSync, spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as L from './lib.mjs';
const [S3, SCRATCH, ONLY] = process.argv.slice(2);
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const out = [];
const PRO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 RenaPro/1.0.3';
let ip = 1;
const NET =
  '198.' + (19 + Math.floor(Math.random() * 200)) + '.' + Math.floor(Math.random() * 250) + '.';
const ctxOpts = (extra = {}) => ({ extraHTTPHeaders: { 'x-forwarded-for': NET + ip++ }, ...extra });
const objects = () => {
  const r = [];
  const w = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      statSync(p).isDirectory() ? w(p) : r.push(p);
    }
  };
  w(S3);
  return r;
};
const hasObject = (path) => objects().some((o) => o.endsWith(path));
const ops = (...a) =>
  execFileSync('npx', ['tsx', `${SCRATCH}/walk/rig-ops.ts`, ...a], {
    encoding: 'utf8',
    env: process.env,
  })
    .trim()
    .split('\n')
    .pop();
const userOf = (email) =>
  db.user.findUnique({
    where: { email },
    select: {
      id: true,
      cleanerProfile: { select: { id: true } },
      cleanerApplication: true,
      cleanerVetting: true,
    },
  });
async function signedIn(email) {
  const c = await b.newContext(ctxOpts());
  const p = await c.newPage();
  await L.login(p, email);
  return { c, p };
}
let stand = null;
const standDown = () => {
  execFileSync('bash', [
    '-c',
    "ps aux | grep -v grep | grep 's3stand/server.mjs' | awk '{print $2}' | xargs -r kill",
  ]);
};
const standUp = () => {
  execFileSync('bash', [
    '-c',
    `(nohup node ${SCRATCH}/s3stand/server.mjs ${S3} 9100 >> ${SCRATCH}/s3stand.log 2>&1 &)`,
  ]);
};

// E1 two devices.
if (!ONLY || ONLY === 'E1') {
  const email = `walk-edge-two-${Date.now()}@integration.invalid`;
  const c0 = await b.newContext(ctxOpts());
  const p0 = await c0.newPage();
  await L.open(p0);
  await L.step0(p0, email);
  await L.step1(p0);
  await c0.close();
  const A = await signedIn(email);
  const B = await signedIn(email);
  await L.openResume(A.p);
  await L.openResume(B.p);
  const vBefore = (await userOf(email)).cleanerApplication.version;
  await L.step2(A.p);
  const afterA = await L.stepLabel(A.p);
  await B.p.locator('main input[type=text]').first().fill('19');
  await B.p.locator('main input[type=number]').first().fill('35');
  await B.p.getByRole('button', { name: 'Continue', exact: true }).click();
  await B.p.waitForTimeout(2500);
  const bt = await L.text(B.p);
  const d = (await userOf(email)).cleanerApplication;
  out.push(
    `E1 two devices: version before ${vBefore}; device A Continue lands step ${afterA}; device B (stale) told "${(bt.match(/Your application was updated on another device\. We have loaded the latest version\./) || ['(no notice)'])[0]}", now on step ${await L.stepLabel(B.p)}; server hoursPerWeek=${d.data.hoursPerWeek} version=${d.version} (B's 35 did not land)`
  );
  await A.c.close();
  await B.c.close();
}

// E2 upload failure keeps progress.
if (!ONLY || ONLY === 'E2') {
  const email = `walk-edge-upload-${Date.now()}@integration.invalid`;
  const c = await b.newContext(ctxOpts());
  const p = await c.newPage();
  await L.open(p);
  await L.step0(p, email);
  await L.step1(p);
  await L.step2(p);
  const before = (await userOf(email)).cleanerApplication;
  standDown();
  await new Promise((r) => setTimeout(r, 500));
  await p.locator('main input[type=file]').nth(0).setInputFiles(L.DOC);
  await p.waitForTimeout(3000);
  const t = await L.text(p);
  const u = await userOf(email);
  const rows = await db.documentUpload.count({ where: { userId: u.id } });
  out.push(
    `E2 storage down: page says "${(t.match(/That upload did not go through[^.]*\.[^.]*\./) || ['(no message)'])[0]}"; document rows=${rows}; draft version ${before.version} -> ${u.cleanerApplication.version}, step ${before.currentStep} -> ${u.cleanerApplication.currentStep}`
  );
  standUp();
  await new Promise((r) => setTimeout(r, 800));
  await p.locator('main input[type=file]').nth(0).setInputFiles(L.DOC);
  await p.waitForTimeout(3000);
  out.push(
    `E2 storage back, same file again: stored rows=${await db.documentUpload.count({ where: { userId: u.id, storageState: 'STORED' } })}`
  );
  await c.close();
}

// E3/E4 resume at Review on a fresh browser shows stored documents; forced finalisation failure, then success.
if (!ONLY || ONLY === 'E3') {
  const email = `walk-edge-final-${Date.now()}@integration.invalid`;
  const c0 = await b.newContext(ctxOpts());
  const p0 = await c0.newPage();
  await L.open(p0);
  for (const s of ['step0', 'step1', 'step2', 'step3', 'step4', 'step5']) {
    if (s === 'step0') await L.step0(p0, email);
    else await L[s](p0);
  }
  await c0.close();
  const F = await signedIn(email);
  await L.openResume(F.p);
  const ft = await L.text(F.p);
  out.push(
    `E3 fresh browser resume at step ${await L.stepLabel(F.p)}: review lists Photo ID ${/Photo ID:\s*Uploaded/.test(ft) ? 'Uploaded' : '(missing)'}, Right to work ${/Right to Work[^:]*:\s*Uploaded/i.test(ft) ? 'Uploaded' : 'see text'}`
  );
  const u = await userOf(email);
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION rig_fail_agreement() RETURNS trigger AS $$ BEGIN IF NEW."cleanerId" = '${u.id}' THEN RAISE EXCEPTION 'rig forced failure'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER rig_fail_agreement BEFORE INSERT ON "AgreementAcceptance" FOR EACH ROW EXECUTE FUNCTION rig_fail_agreement()`
  );
  await F.p.locator('main input[type=checkbox]').last().check();
  await F.p.getByRole('button', { name: 'Submit Application' }).click();
  await F.p.waitForTimeout(4000);
  const failText = await L.text(F.p);
  const mid = await userOf(email);
  out.push(
    `E4 forced finalisation failure: page says "${(failText.match(/We could not submit your application just now\.[^.]*\./) || ['(no message)'])[0]}"; profile=${!!mid.cleanerProfile}; draft ${mid.cleanerApplication.status} v${mid.cleanerApplication.version}; draft docs still DRAFT=${await db.documentUpload.count({ where: { userId: u.id, reviewState: 'DRAFT', storageState: 'STORED' } })}`
  );
  await db.$executeRawUnsafe(`DROP TRIGGER rig_fail_agreement ON "AgreementAcceptance"`);
  await db.$executeRawUnsafe(`DROP FUNCTION rig_fail_agreement()`);
  await F.p.getByRole('button', { name: 'Submit Application' }).click();
  await F.p.waitForTimeout(6000);
  const done = await userOf(email);
  const docs = await db.documentUpload.findMany({ where: { userId: u.id, isDestroyed: false } });
  out.push(
    `E4 retry: lands on ${new URL(F.p.url()).pathname}; profile=${!!done.cleanerProfile}; draft ${done.cleanerApplication.status}; vetting date of birth=${done.cleanerVetting?.dateOfBirth.toISOString().slice(0, 10)}; documents ${docs.map((x) => `${x.documentType}:${x.reviewState}:${x.profileId ? 'linked' : 'unlinked'}:${hasObject(x.storagePath) ? 'object' : 'NO-OBJECT'}`).join(', ')}`
  );
  await F.c.close();
}

// E5 the logged-out native join flow finishes with the single-use handoff code.
if (!ONLY || ONLY === 'E5') {
  const email = `walk-edge-native-${Date.now()}@integration.invalid`;
  const c = await b.newContext(
    ctxOpts({
      userAgent: PRO_UA,
      extraHTTPHeaders: { 'x-rena-shell': 'pro-ios/1.0.3', 'x-forwarded-for': NET + ip++ },
    })
  );
  await c.addInitScript(() => {
    window.__posted = [];
    window.ReactNativeWebView = { postMessage: (m) => window.__posted.push(m) };
  });
  const p = await c.newPage();
  await p.goto('http://localhost:3000/join', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p
    .getByRole('button', { name: /Start|Apply|Get started|Begin/i })
    .first()
    .click()
    .catch(() => {});
  await p.waitForTimeout(800);
  for (const s of ['step0', 'step1', 'step2', 'step3', 'step4', 'step5']) {
    if (s === 'step0') await L.step0(p, email);
    else await L[s](p);
  }
  const sub = p.waitForResponse((r) => r.url().endsWith('/api/cleaners/application/submit'));
  await p.locator('main input[type=checkbox]').last().check();
  await p.getByRole('button', { name: 'Submit Application' }).click();
  const body = await (await sub).json();
  await p.waitForTimeout(1500);
  const posted = await p.evaluate(() => window.__posted.map((m) => JSON.parse(m)));
  out.push(
    `E5 Pro logged-out join: response handoff=${body.handoff}; posted ${posted.length} message(s): ${posted.map((m) => `${m.type} keys=${Object.keys(m).sort().join(',')} codeLength=${String(m.handoffCode || '').length}`).join(' | ')}; screen "${((await L.text(p)).match(/Your application is in\./) || ['?'])[0]}"`
  );
  await c.close();
}

// E6 admin removal: a stale open browser gets the terminal state; objects go.
if (!ONLY || ONLY === 'E6') {
  const email = `walk-edge-removed-${Date.now()}@integration.invalid`;
  const c = await b.newContext(ctxOpts());
  const p = await c.newPage();
  await L.open(p);
  await L.step0(p, email);
  await L.step1(p);
  await L.step2(p);
  await p.locator('main input[type=file]').nth(0).setInputFiles(L.DOC);
  await p.waitForTimeout(2500);
  const u = await userOf(email);
  const paths = (await db.documentUpload.findMany({ where: { userId: u.id } })).map(
    (d) => d.storagePath
  );
  const r = ops('remove', email);
  await p.locator('main select').first().selectOption('uk_passport');
  await p.locator('main input[type=file]').nth(1).setInputFiles(L.DOC);
  await p.waitForTimeout(2500);
  const t = await L.text(p);
  out.push(
    `E6 admin removal ${r}: objects left=${paths.filter(hasObject).length} of ${paths.length}; user row=${(await userOf(email)) ? 'exists' : 'gone'}; the stale open tab now shows "${(t.match(/This application no longer exists\./) || ['(no terminal state)'])[0]}"`
  );
  await p.reload({ waitUntil: 'load' });
  await p.waitForTimeout(2500);
  out.push(
    `E6 the same tab reloaded: "${((await L.text(p)).match(/This application no longer exists\.|You already started an application/) || ['(other)'])[0]}"`
  );
  await c.close();
}

// E7 30 days idle: the sweep removes draft, documents, objects and account.
if (!ONLY || ONLY === 'E7') {
  const email = `walk-edge-expiry-${Date.now()}@integration.invalid`;
  const c = await b.newContext(ctxOpts());
  const p = await c.newPage();
  await L.open(p);
  await L.step0(p, email);
  await L.step1(p);
  await L.step2(p);
  await p.locator('main input[type=file]').nth(0).setInputFiles(L.DOC);
  await p.waitForTimeout(2500);
  await c.close();
  const u = await userOf(email);
  const paths = (await db.documentUpload.findMany({ where: { userId: u.id } })).map(
    (d) => d.storagePath
  );
  ops('age', email);
  const r1 = ops('sweep');
  const r2 = ops('sweep');
  out.push(
    `E7 expiry sweep ${r1} then ${r2}: user=${(await userOf(email)) ? 'exists' : 'gone'}; draft=${(await db.cleanerApplicationDraft.findUnique({ where: { userId: u.id } })) ? 'exists' : 'gone'}; document rows=${await db.documentUpload.count({ where: { userId: u.id } })}; objects left=${paths.filter(hasObject).length} of ${paths.length}`
  );
}

await b.close();
await db.$disconnect();
console.log(out.join('\n'));
