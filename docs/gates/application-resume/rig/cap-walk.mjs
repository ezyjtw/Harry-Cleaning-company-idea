/* eslint-disable */
// Rig-only bench tool (gate evidence for D-ah, RENA-031/082); not product code.
// B5 capability walk (James-ruled 8 Oct): the Pro join's final submit in a
// capable shell (Pro-4 UA), a legacy shell (bridge, no capability) and the
// website, with a forced handoff mint failure and the 10 second safety net.
import { chromium } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import * as L from './lib.mjs';
const db = new PrismaClient();
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const PRO_4 = `${IPHONE} RenaPro/1.0.4 RenaCap/signedUpHandoffV1`;
const PRO_LEGACY = `${IPHONE} RenaPro/1.0.3`;
const NET =
  '198.' + (19 + Math.floor(Math.random() * 200)) + '.' + Math.floor(Math.random() * 250) + '.';
let ip = 1;
const out = [];
const ONLY = process.argv[2] || '';
const run = (k) => !ONLY || ONLY.split(',').includes(k);
const failures = [];
const expectThat = (label, cond) => {
  if (!cond) failures.push(label);
};
const BASE = 'http://localhost:3000';

async function context(ua, shellHeader) {
  const headers = { 'x-forwarded-for': NET + ip++ };
  if (shellHeader) headers['x-rena-shell'] = shellHeader;
  const c = await b.newContext({ ...(ua ? { userAgent: ua } : {}), extraHTTPHeaders: headers });
  await c.addInitScript(() => {
    window.__posted = [];
    window.ReactNativeWebView = { postMessage: (m) => window.__posted.push(m) };
    const mark = () => {
      if (document.body && /Signing you in/.test(document.body.innerText))
        sessionStorage.setItem('sawSigningIn', '1');
    };
    new MutationObserver(mark).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
  return c;
}
async function toReview(p, email) {
  await L.open(p);
  if (!(await p.locator('main input[type=text]').count())) {
    await p
      .getByRole('button', { name: /Start|Apply|Get started|Begin/i })
      .first()
      .click()
      .catch(() => {});
    await p.waitForTimeout(800);
  }
  for (const s of ['step0', 'step1', 'step2', 'step3', 'step4', 'step5']) {
    if (s === 'step0') await L.step0(p, email);
    else await L[s](p);
  }
  await p.locator('main input[type=checkbox]').last().check();
}
/** Submit, then sample the page every 250ms for `ms`: path, screen, posts. */
async function submitAndWatch(p, ms) {
  const sub = p.waitForResponse((r) => r.url().endsWith('/api/cleaners/application/submit'));
  const t0 = Date.now();
  await p.getByRole('button', { name: 'Submit Application' }).click();
  const body = await (await sub).json();
  let leftJoinAt = null;
  let signingAt85 = null;
  while (Date.now() - t0 < ms) {
    const path = new URL(p.url()).pathname;
    if (leftJoinAt === null && !/\/join$/.test(path)) leftJoinAt = Date.now() - t0;
    if (signingAt85 === null && Date.now() - t0 >= 8500)
      signingAt85 = { path, signing: /Signing you in/.test(await L.text(p).catch(() => '')) };
    await p.waitForTimeout(250);
  }
  const posted = await p.evaluate(() => window.__posted.map((m) => JSON.parse(m)));
  const saw = await p.evaluate(() => sessionStorage.getItem('sawSigningIn') === '1');
  return { body, leftJoinAt, signingAt85, posted, saw, finalPath: new URL(p.url()).pathname };
}
const fmt = (r) =>
  `response handoff=${r.body.handoff}${r.body.next ? ` next=${r.body.next}` : ''}; posted=${r.posted.length}; "Signing you in" ever shown=${r.saw}; left /join after ${r.leftJoinAt === null ? 'never' : `${(r.leftJoinAt / 1000).toFixed(1)}s`}; final path ${r.finalPath}`;
const unusedCodes = async (email) => {
  const u = await db.user.findUnique({ where: { email }, select: { id: true } });
  const rows = await db.nativeHandoffCode.findMany({ where: { userId: u.id } });
  return (
    rows
      .map(
        (r) =>
          `${r.usedAt ? 'used' : 'unused'} ttl=${Math.round((r.expiresAt - r.createdAt) / 1000)}s`
      )
      .join(',') || 'none'
  );
};

// (i) capable shell, forced mint failure.
if (run('i')) {
  const email = `walk-cap-mintfail-${Date.now()}@integration.invalid`;
  const c = await context(PRO_4, 'pro-ios/1.0.4');
  const p = await c.newPage();
  await toReview(p, email);
  const u = await db.user.findUnique({ where: { email } });
  await db.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION rig_fail_mint() RETURNS trigger AS $$ BEGIN IF NEW."userId" = '${u.id}' THEN RAISE EXCEPTION 'rig forced mint failure'; END IF; RETURN NEW; END $$ LANGUAGE plpgsql`
  );
  await db.$executeRawUnsafe(
    `CREATE TRIGGER rig_fail_mint BEFORE INSERT ON "NativeHandoffCode" FOR EACH ROW EXECUTE FUNCTION rig_fail_mint()`
  );
  try {
    const r = await submitAndWatch(p, 6000);
    const after = await db.user.findUnique({
      where: { email },
      select: { cleanerProfile: { select: { id: true } } },
    });
    expectThat(
      '(i)',
      r.body.handoff === 'none' &&
        r.posted.length === 0 &&
        !r.saw &&
        r.leftJoinAt !== null &&
        r.leftJoinAt < 3000 &&
        /^\/cleaner/.test(r.finalPath) &&
        !!after.cleanerProfile
    );
    out.push(
      `(i) Pro capable shell, forced mint failure: ${fmt(r)}; application committed=${!!after.cleanerProfile}; handoff codes ${await unusedCodes(email)}`
    );
  } finally {
    await db.$executeRawUnsafe(`DROP TRIGGER rig_fail_mint ON "NativeHandoffCode"`);
    await db.$executeRawUnsafe(`DROP FUNCTION rig_fail_mint()`);
  }
  await c.close();
}

// (ii) legacy shell (bridge present, no capability), successful submit.
if (run('ii')) {
  const email = `walk-cap-legacy-${Date.now()}@integration.invalid`;
  const c = await context(PRO_LEGACY, 'pro-ios/1.0.3');
  const p = await c.newPage();
  await toReview(p, email);
  const r = await submitAndWatch(p, 6000);
  expectThat(
    '(ii)',
    r.body.handoff === 'code' &&
      r.posted.length === 0 &&
      !r.saw &&
      r.leftJoinAt !== null &&
      r.leftJoinAt < 3000 &&
      /^\/cleaner/.test(r.finalPath)
  );
  out.push(
    `(ii) Pro legacy shell: ${fmt(r)}; handoff codes ${await unusedCodes(email)} (minted, never posted, left to expire)`
  );
  await c.close();
}

// (iv) capable shell: exactly one post with the one-time code; no premature
// fallback; the safety net then moves the page on by itself.
if (run('iv')) {
  const email = `walk-cap-capable-${Date.now()}@integration.invalid`;
  const c = await context(PRO_4, 'pro-ios/1.0.4');
  const p = await c.newPage();
  await toReview(p, email);
  const r = await submitAndWatch(p, 13000);
  const m = r.posted[0] || {};
  expectThat(
    '(iv) one post, no premature fallback, net moves on',
    r.posted.length === 1 &&
      m.handoffCode === r.body.handoffCode &&
      r.signingAt85?.signing === true &&
      /\/join$/.test(r.signingAt85?.path || '') &&
      r.leftJoinAt !== null &&
      r.leftJoinAt >= 10000 &&
      r.leftJoinAt < 13000
  );
  out.push(
    `(iv) Pro capable shell: ${fmt(r)}; at 8.5s path ${r.signingAt85?.path} showing "Signing you in"=${r.signingAt85?.signing}; message keys=${Object.keys(m).sort().join(',')} type=${m.type} role=${m.role} email matches=${m.email === email} code equals response code=${m.handoffCode === r.body.handoffCode}`
  );
  const spoof = await fetch(`${BASE}/api/auth/native-handoff`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1.15 RenaCap/signedUpHandoffV1',
      'x-forwarded-for': NET + ip++,
    },
    body: JSON.stringify({ code: m.handoffCode }),
  });
  const app = await fetch(`${BASE}/api/auth/native-handoff`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rena-shell': 'pro-ios/1.0.4',
      'x-forwarded-for': NET + ip++,
    },
    body: JSON.stringify({ code: m.handoffCode }),
  });
  const appBody = await app.json();
  const replay = await fetch(`${BASE}/api/auth/native-handoff`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-rena-shell': 'pro-ios/1.0.4',
      'x-forwarded-for': NET + ip++,
    },
    body: JSON.stringify({ code: m.handoffCode }),
  });
  expectThat(
    '(iv) redemption',
    spoof.status === 400 && app.status === 200 && replay.status === 400
  );
  out.push(
    `(iv) the posted code: redeemed by a spoofed capability browser ${spoof.status}; by the Pro shell signature ${app.status} (token ${typeof appBody.token === 'string' ? 'issued' : 'none'}); replay ${replay.status}`
  );
  await c.close();
}

// (v) spoofed capability in a plain browser: the server sees a website.
if (run('v')) {
  const email = `walk-cap-spoof-${Date.now()}@integration.invalid`;
  const c = await context('Mozilla/5.0 (Macintosh) Safari/605.1.15 RenaCap/signedUpHandoffV1');
  const p = await c.newPage();
  await toReview(p, email);
  const r = await submitAndWatch(p, 6000);
  expectThat(
    '(v)',
    r.body.handoff === 'none' &&
      !('handoffCode' in r.body) &&
      !('token' in r.body) &&
      !('bridgeCode' in r.body) &&
      r.posted.length === 0 &&
      !r.saw
  );
  out.push(
    `(v) spoofed capability, plain browser: ${fmt(r)}; response carries handoffCode=${'handoffCode' in r.body} token=${'token' in r.body} bridgeCode=${'bridgeCode' in r.body}; handoff codes ${await unusedCodes(email)}`
  );
  await c.close();
}

// Website control.
if (run('web')) {
  const email = `walk-cap-web-${Date.now()}@integration.invalid`;
  const c = await context();
  const p = await c.newPage();
  await toReview(p, email);
  const r = await submitAndWatch(p, 6000);
  out.push(`website control: ${fmt(r)}`);
  await c.close();
}

// Safety net on the completed screen: a submit answered with no next and no
// code (forced at the network layer) shows "Application Received!", and the
// page moves on to /cleaner by itself after 10 seconds.
if (run('net')) {
  const email = `walk-cap-net-${Date.now()}@integration.invalid`;
  const c = await context(PRO_LEGACY, 'pro-ios/1.0.3');
  const p = await c.newPage();
  await toReview(p, email);
  await p.route('**/api/cleaners/application/submit', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' })
  );
  const r = await submitAndWatch(p, 13000);
  expectThat(
    'safety net, completed screen',
    r.leftJoinAt !== null &&
      r.leftJoinAt >= 10000 &&
      r.leftJoinAt < 13000 &&
      /^\/cleaner/.test(r.finalPath)
  );
  out.push(
    `safety net, completed screen: left /join after ${r.leftJoinAt === null ? 'never' : `${(r.leftJoinAt / 1000).toFixed(1)}s`}; final path ${r.finalPath}`
  );
  await c.close();
}

await b.close();
await db.$disconnect();
console.log(out.join('\n'));
console.log(failures.length ? `FAILED: ${failures.join('; ')}` : 'ALL EXPECTATIONS MET');
process.exit(failures.length ? 1 : 0);
