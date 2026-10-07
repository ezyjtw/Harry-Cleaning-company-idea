// B4 admin rooms drive: stuck-money queue, an action, admin pricing, booking money panel.
import { createRequire } from 'module';
const require = createRequire('/home/user/Harry-Cleaning-company-idea/package.json');
const { chromium } = require('playwright');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const BASE = 'http://localhost:3000';
const PASS = 'E2e-Fixture-Pass-2026!';
const out = {};
const admin = await prisma.user.upsert({
  where: { email: 'b4-drive-admin@integration.invalid' },
  update: { passwordHash: await bcrypt.hash(PASS, 10), role: 'ADMIN' },
  create: { email: 'b4-drive-admin@integration.invalid', name: 'Drive Admin', role: 'ADMIN', passwordHash: await bcrypt.hash(PASS, 10), emailVerified: new Date() },
});
const cleaner = await prisma.user.findFirst({ where: { role: 'CLEANER', email: { endsWith: '@integration.invalid' } } });
const mk = (extra) => prisma.booking.create({ data: { cleanerId: cleaner.id, serviceType: 'regular', date: new Date(Date.now() + 5 * 864e5), startTime: '10:00', duration: 3, totalPrice: 60, totalAmountCharged: 60, platformFee: 10, cleanerEarnings: 50, status: 'COMPLETED', paymentStatus: 'SUCCEEDED', transferStatus: 'PENDING', stripePaymentIntentId: 'pi_drive_' + Math.random().toString(36).slice(2), stripeChargeId: 'ch_drive_' + Math.random().toString(36).slice(2), addressPostcode: 'E4 7AA', ...extra } });
const noClock = await mk({ releaseDueAt: null });
const shortfall = await mk({ transferStatus: 'PAUSED', amountShortfallPence: 300 });
const failed = await mk({ transferStatus: 'FAILED', transferFailureReason: 'Fake: refused' });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext()).newPage();
await page.setExtraHTTPHeaders({ 'x-forwarded-for': '203.0.113.77' });
await page.goto(BASE + '/login');
await page.fill('input[type="email"]', admin.email);
await page.locator('input[type="password"]').first().fill(PASS);
await page.locator('form button[type="submit"]').click();
await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 });
await page.goto(BASE + '/admin/bookings/stuck-money');
await page.waitForSelector('h1');
out.stuckHeader = await page.locator('h1 + p').first().innerText();
out.stuckGroups = await page.locator('h2').allInnerTexts();
const row = page.locator('tr', { hasText: noClock.id.substring(0, 8).toUpperCase() }).filter({ has: page.getByRole('button', { name: 'Set release clock' }) });
out.noClockRow = (await row.innerText()).replace(/\s+/g, ' ');
await row.getByRole('button', { name: 'Set release clock' }).click();
await page.waitForTimeout(1500);
out.afterAction = (await prisma.booking.findUnique({ where: { id: noClock.id } })).releaseDueAt ? 'releaseDueAt set' : 'not set';
const sfRow = page.locator('tr', { hasText: shortfall.id.substring(0, 8).toUpperCase() }).filter({ has: page.getByRole('button', { name: 'Clear shortfall' }) });
const sfHandle = await sfRow.elementHandle();
await sfRow.getByRole('button', { name: 'Clear shortfall' }).click();
out.confirmPrompt = (await sfHandle.innerText()).replace(/\s+/g, ' ');
await page.goto(BASE + '/admin/pricing');
await page.waitForSelector('text=Rates');
out.ratesSection = (await page.locator('section').first().innerText()).replace(/\s+/g, ' ');
out.editButtons = await page.getByRole('button', { name: 'Edit' }).count();
out.systemLabels = await page.locator('text=System').count();
const res = await page.evaluate(async () => (await fetch('/api/admin/pricing/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'last_compliance_run_date', value: '2030-01-01' }) })).status);
out.markerPostStatus = res;
await page.goto(BASE + '/admin/bookings/' + failed.id);
await page.waitForSelector('text=Pricing');
out.moneyPanel = (await page.locator('text=Refundable').locator('..').innerText()).replace(/\s+/g, ' ');
console.log(JSON.stringify(out, null, 2));
await browser.close();
for (const b of [noClock, shortfall, failed]) {
  await prisma.auditLog.deleteMany({ where: { entityId: b.id } });
  await prisma.booking.delete({ where: { id: b.id } });
}
await prisma.$disconnect();
