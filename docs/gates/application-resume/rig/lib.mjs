/* eslint-disable */
// Rig-only bench tool (gate evidence for RENA-100/101); not product code.
export const PW = 'Str0ng!Passw0rd-2026';
export async function dump(p, tag) {
  const els = await p.$$eval('main input,main select,main textarea,main button,main label', (n) =>
    n
      .filter((e) => e.offsetParent !== null)
      .map(
        (e) =>
          `${e.tagName} type=${e.type || ''} ph=${e.placeholder || ''} aria=${e.getAttribute('aria-label') || ''} text=${(e.innerText || '').replace(/\s+/g, ' ').slice(0, 50)}`
      )
  );
  console.log(`--- ${tag} ${p.url()}\n` + [...new Set(els)].join('\n'));
}
export async function errors(p) {
  return (
    await p.$$eval('[role=alert], .text-red-600, .text-red-500, p.text-error, .text-danger', (n) =>
      n.map((e) => e.innerText.trim()).filter(Boolean)
    )
  ).join(' | ');
}
export async function open(p) {
  await p.goto('http://localhost:3000/join', { waitUntil: 'load' });
  await p.waitForTimeout(1500);
  await p
    .getByRole('button', { name: 'Essential Only' })
    .click()
    .catch(() => {});
  const s = p.getByRole('button', { name: /START YOUR APPLICATION/i });
  if (await s.count()) await s.click();
  await p.waitForTimeout(600);
}
export async function step0(p, email) {
  const t = p.locator('main input[type=text]');
  await t.nth(0).fill('Walk');
  await t.nth(1).fill('Cleaner');
  await p.locator('main input[type=email]').fill(email);
  await p.locator('main input[type=tel]').fill('07700900123');
  await p.getByPlaceholder('e.g. E4 6AP').fill('E4 6AP');
  const s = p.locator('main select');
  await s.nth(0).selectOption({ index: 5 });
  await s.nth(1).selectOption({ index: 3 });
  await s.nth(2).selectOption({ label: '1990' });
  await p.getByPlaceholder('Min. 8 characters').fill(PW);
  await p.getByPlaceholder('Re-enter password').fill(PW);
  await p.getByRole('button', { name: 'Continue', exact: true }).click();
  await p.waitForTimeout(2500);
}
export async function next(p) {
  await p.getByRole('button', { name: 'Continue', exact: true }).click();
  await p.waitForTimeout(900);
}
export async function step1(p) {
  await p.locator('main input[type=number]').first().fill('5');
  await p.getByRole('button', { name: 'Regular Cleaning' }).click();
  await p.getByRole('button', { name: 'English', exact: true }).click();
  await p.locator('main textarea').fill('Rig walk bio for a synthetic cleaner.');
  await next(p);
}
export async function step2(p) {
  await p.locator('main input[type=text]').first().fill('18');
  await p.locator('main input[type=number]').first().fill('20');
  await next(p);
}
export async function files(p) {
  return p.$$eval('main input[type=file], main select', (n) =>
    n.map(
      (e) =>
        `${e.tagName} accept=${e.accept || ''} capture=${e.getAttribute('capture') || ''} opts=${e.tagName === 'SELECT' ? [...e.options].map((o) => o.value).join(',') : ''}`
    )
  );
}
export const DOC =
  '/tmp/claude-0/-home-user-Harry-Cleaning-company-idea/a758c5d5-1a1f-53a7-a7f7-5c9231232b70/scratchpad/walk/doc.png';
export async function step3(p) {
  const f = p.locator('main input[type=file]');
  await f.nth(0).setInputFiles(DOC);
  await p.locator('main select').first().selectOption('uk_passport');
  await f.nth(1).setInputFiles(DOC);
  await p.waitForTimeout(500);
  await next(p);
}
export async function step4(p) {
  await p.getByRole('button', { name: /I don.t have a DBS certificate/ }).click();
  await p.locator('main input[type=file]').last().setInputFiles(DOC);
  await p.waitForTimeout(800);
  await next(p);
}
export async function step5(p) {
  await p.locator('main input[type=checkbox]').first().check();
  await next(p);
}
export const text = (p) =>
  p.evaluate(() =>
    (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ')
  );
export const draft = (p) =>
  p.evaluate(() => {
    try {
      const d = JSON.parse(localStorage.getItem('rena-join-wizard') || 'null');
      return (
        d && {
          currentStep: d.currentStep,
          accountCreated: d.accountCreated,
          hasPassword: !!d.form?.password,
          photoIdFile: d.form?.photoIdFile,
          selfiePhoto: d.form?.selfiePhoto,
        }
      );
    } catch {
      return 'unreadable';
    }
  });
export async function login(p, email) {
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await p
    .getByRole('button', { name: 'Essential Only' })
    .click()
    .catch(() => {});
  await p.locator('input[type=email]').fill(email);
  await p.locator('input[type=password]').first().fill(PW);
  await p.locator('form button[type=submit]').first().click();
  await p.waitForTimeout(4000);
}
export const stepLabel = async (p) => ((await text(p)).match(/Step (\d) of 7/) || [null, '?'])[1];
export async function openResume(p) {
  await p.goto('http://localhost:3000/join', { waitUntil: 'load' });
  await p
    .getByRole('button', { name: 'Essential Only' })
    .click({ timeout: 1500 })
    .catch(() => {});
  await p.waitForTimeout(2500);
}
