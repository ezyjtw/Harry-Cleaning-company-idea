import { expect, test, type Page } from '@playwright/test';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { PRE_ACCEPT_KEYS } from '../src/lib/booking/cleaner-view';
import { londonParts } from '../src/lib/time/booking-time';

import { FIXTURES, hasFixtures, isolateRateBucket, signIn } from './fixtures';
import { FIXTURE_PASSWORD } from './global-setup';

// B3 (RENA-033): the cleaner lifecycle on the rig. Synthetic fixture accounts
// only; Stripe is never reached (release itself is proven in B4).

// The RENA-006 CSRF rule refuses a mutation without a same-site Origin; a
// browser sends one, Playwright's request context does not.
const SAME_ORIGIN = { origin: 'http://localhost:3000' };

const CLEANER_B = { email: 'e2e-cleaner-b@integration.invalid', name: 'Brio Fixture' };

type Prisma = PrismaClient;
let prisma: Prisma;
const ids = { cleaner: '', cleanerB: '', customer: '' };
const created: string[] = [];
let savedProfile: { bio: string | null; specialties: string[] } | null = null;

/** The UTC-midnight booking day and HH:MM London wall clock of an instant. */
function londonSlot(at: Date): { date: Date; time: string } {
  const p = londonParts(at);
  return {
    date: new Date(Date.UTC(p.y, p.m - 1, p.day)),
    time: `${String(p.hour).padStart(2, '0')}:${String(p.min).padStart(2, '0')}`,
  };
}

async function booking(data: Record<string, unknown>): Promise<string> {
  const row = await prisma.booking.create({
    data: {
      clientId: ids.customer,
      cleanerId: ids.cleaner,
      serviceType: 'regular',
      duration: 2,
      totalPrice: 60,
      platformFee: 6,
      cleanerEarnings: 50,
      status: 'ACCEPTED',
      paymentStatus: 'SUCCEEDED',
      addressLine1: '1 Fixture Road',
      addressPostcode: 'E4 7AA',
      addressCity: 'Chingford',
      notes: 'Fixture note: gate code',
      ...data,
    } as never,
  });
  created.push(row.id);
  return row.id;
}

test.describe('B3 cleaner lifecycle', () => {
  test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

  test.beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
    const cleaner = await prisma.user.findUniqueOrThrow({
      where: { email: FIXTURES.cleaner.email },
    });
    const customer = await prisma.user.findUniqueOrThrow({
      where: { email: FIXTURES.customerA.email },
    });
    ids.cleaner = cleaner.id;
    ids.customer = customer.id;
    // The web portal routes an incomplete profile to complete-profile; the
    // portal pages under test need a complete one (restored afterwards).
    savedProfile = await prisma.cleanerProfile.findUniqueOrThrow({
      where: { userId: cleaner.id },
      select: { bio: true, specialties: true },
    });
    await prisma.cleanerProfile.update({
      where: { userId: cleaner.id },
      data: { bio: 'Fixture bio for the B3 specs.', specialties: ['regular'] },
    });
    const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 10);
    const b = await prisma.user.upsert({
      where: { email: CLEANER_B.email },
      update: { passwordHash, accountStatus: 'ACTIVE', role: 'CLEANER' },
      create: {
        email: CLEANER_B.email,
        name: CLEANER_B.name,
        role: 'CLEANER',
        passwordHash,
        emailVerified: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    ids.cleanerB = b.id;
    await prisma.cleanerProfile.upsert({
      where: { userId: b.id },
      update: { verified: true, hourlyRateRegular: 20 },
      create: {
        userId: b.id,
        verified: true,
        hourlyRateRegular: 20,
        serviceTypes: ['regular'],
        specialties: [],
        languages: ['English'],
      },
    });
  });

  test.afterEach(async () => {
    if (created.length) {
      await prisma.auditLog.deleteMany({ where: { entityId: { in: created } } });
      await prisma.notification.deleteMany({
        where: { userId: { in: [ids.customer, ids.cleaner, ids.cleanerB] } },
      });
      await prisma.booking.deleteMany({ where: { id: { in: created.splice(0) } } });
    }
  });

  test.afterAll(async () => {
    if (savedProfile) {
      await prisma.cleanerProfile.update({ where: { userId: ids.cleaner }, data: savedProfile });
    }
    // A blocked deletion never deactivates; this is the belt if one ever did.
    await prisma.user.updateMany({
      where: { email: { in: [FIXTURES.cleaner.email, CLEANER_B.email] } },
      data: { accountStatus: 'ACTIVE' },
    });
    await prisma.$disconnect();
  });

  test.beforeEach(async ({ page }) => {
    await isolateRateBucket(page);
  });

  async function asCleaner(page: Page) {
    await signIn(page, 'cleaner');
  }

  test('happy path: On my way then Mark complete, releaseDueAt set', async ({ page }) => {
    const slot = londonSlot(new Date(Date.now() - 40 * 60 * 1000));
    const id = await booking({ date: slot.date, startTime: slot.time, duration: 1 });
    await asCleaner(page);
    await page.goto(`/cleaner/jobs/${id}`);
    await page.getByRole('button', { name: 'On my way' }).click();
    await expect(page.getByRole('button', { name: 'Mark complete' })).toBeVisible();
    const done = page.waitForResponse(
      (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/cleaner/jobs/${id}`)
    );
    await page.getByRole('button', { name: 'Mark complete' }).click();
    expect((await done).status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('COMPLETED');
    expect(row.arrivalConfirmed).toBe(true);
    expect(row.completedAt).not.toBeNull();
    expect(row.releaseDueAt).not.toBeNull();
  });

  test('premature On my way shows the London time it opens; nothing changes', async ({ page }) => {
    const tomorrow = londonSlot(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const id = await booking({ date: tomorrow.date, startTime: '10:00' });
    await asCleaner(page);
    await page.goto(`/cleaner/jobs/${id}`);
    await page.getByRole('button', { name: 'On my way' }).click();
    const note = page.getByTestId('job-action-note');
    await expect(note).toContainText('You can set On my way from 08:00 on');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('ACCEPTED');
    // The API speaks the 422 contract.
    const res = await page.request.patch(`/api/cleaner/jobs/${id}`, {
      data: { status: 'EN_ROUTE' },
      headers: SAME_ORIGIN,
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('TOO_EARLY');
    expect(body.target).toBe('EN_ROUTE');
    expect(typeof body.opensAt).toBe('string');
  });

  test('a Flexible job on the way offers Start clean, never Mark complete', async ({ page }) => {
    const today = londonSlot(new Date());
    const id = await booking({ date: today.date, startTime: 'Flexible', status: 'EN_ROUTE' });
    await asCleaner(page);
    await page.goto(`/cleaner/jobs/${id}`);
    await expect(page.getByRole('button', { name: 'Start clean' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mark complete' })).toHaveCount(0);
    const res = await page.request.patch(`/api/cleaner/jobs/${id}`, {
      data: { status: 'COMPLETED' },
      headers: SAME_ORIGIN,
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toBe('NEEDS_START');
  });

  test('pre-accept payload: exactly the ruled keys; assigned: the full set; others: 404', async ({
    page,
  }) => {
    const offer = await booking({
      cleanerId: ids.cleanerB,
      backupCleanerIds: [ids.cleaner],
      status: 'AWAITING_CLEANER',
      cascadePhase: 'BACKUP_OFFER',
      cascadeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      date: londonSlot(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)).date,
      startTime: '10:00',
    });
    const mine = await booking({
      date: londonSlot(new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)).date,
      startTime: '14:00',
    });
    const theirs = await booking({
      cleanerId: ids.cleanerB,
      date: londonSlot(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000)).date,
      startTime: '14:00',
    });
    await asCleaner(page);

    const pre = (await (await page.request.get(`/api/cleaner/jobs/${offer}`)).json()).job;
    expect(Object.keys(pre).sort()).toEqual([...PRE_ACCEPT_KEYS].sort());
    expect(pre.customerFirstName).toBe('Alpha');
    expect(pre.postcode).toBe('E4');
    const raw = JSON.stringify(pre);
    for (const leak of [
      'Fixture Road',
      '7AA',
      'gate code',
      FIXTURES.customerA.email,
      'paymentStatus',
    ]) {
      expect(raw).not.toContain(leak);
    }

    const list = await (await page.request.get('/api/cleaner/jobs?status=AWAITING_CLEANER')).json();
    const listed = list.jobs.find((j: { id: string }) => j.id === offer);
    expect(Object.keys(listed).sort()).toEqual([...PRE_ACCEPT_KEYS].sort());

    const full = (await (await page.request.get(`/api/cleaner/jobs/${mine}`)).json()).job;
    expect(full.fullAddress).toContain('1 Fixture Road');
    expect(full.notes).toContain('gate code');

    expect((await page.request.get(`/api/cleaner/jobs/${theirs}`)).status()).toBe(404);
  });

  test('backup acceptance: the first accept wins, the second gets a 409', async ({
    page,
    browser,
  }) => {
    const id = await booking({
      cleanerId: ids.cleaner,
      backupCleanerIds: [ids.cleanerB],
      status: 'AWAITING_CLEANER',
      cascadePhase: 'COMBINED_OFFER',
      cascadeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      date: londonSlot(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)).date,
      startTime: '10:00',
    });
    await asCleaner(page);
    const first = await page.request.post(`/api/cleaner/jobs/${id}/accept`, {
      headers: SAME_ORIGIN,
    });
    expect(first.status()).toBe(200);

    const ctx = await browser.newContext();
    const pageB = await ctx.newPage();
    await isolateRateBucket(pageB);
    await pageB.goto('/login');
    await pageB.fill('input[type="email"]', CLEANER_B.email);
    await pageB.locator('input[type="password"]').first().fill(FIXTURE_PASSWORD);
    await pageB.locator('form button[type="submit"]').click();
    await expect(pageB).not.toHaveURL(/\/login/, { timeout: 20000 });
    const second = await pageB.request.post(`/api/cleaner/jobs/${id}/accept`, {
      headers: SAME_ORIGIN,
    });
    expect(second.status()).toBe(409);
    await ctx.close();
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('ACCEPTED');
    expect(row.cleanerId).toBe(ids.cleaner);
  });

  test('a stale offer is refused with "This offer has expired."', async ({ page }) => {
    const id = await booking({
      cleanerId: ids.cleanerB,
      backupCleanerIds: [ids.cleaner],
      status: 'AWAITING_CLEANER',
      cascadePhase: 'BACKUP_OFFER',
      cascadeExpiresAt: new Date(Date.now() - 60 * 1000),
      date: londonSlot(new Date(Date.now() + 4 * 24 * 60 * 60 * 1000)).date,
      startTime: '10:00',
    });
    await asCleaner(page);
    const res = await page.request.post(`/api/cleaner/jobs/${id}/accept`, { headers: SAME_ORIGIN });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toBe('This offer has expired.');
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe('AWAITING_CLEANER');
    // The Pro offer screen lands on its expired treatment.
    await page
      .context()
      .addCookies([{ name: 'rena-app-preview', value: '1', url: 'http://localhost:3000' }]);
    await page.goto(`/app/offer/${id}`);
    await expect(page.getByText(/expired/i).first()).toBeVisible();
  });

  test('the web Profile carries the deletion door; a live job blocks it', async ({ page }) => {
    await booking({
      date: londonSlot(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)).date,
      startTime: '10:00',
    });
    await asCleaner(page);
    await page.goto('/cleaner/profile');
    await page.getByTestId('profile-delete-account-row').getByRole('link').click();
    await expect(page).toHaveURL(/\/cleaner\/delete-account/);
    await page.getByTestId('delete-account-confirm').fill('DELETE');
    await page.getByTestId('delete-account-password').fill(FIXTURE_PASSWORD);
    await page.getByTestId('delete-account-submit').click();
    const blockers = page.getByTestId('delete-account-blockers');
    await expect(blockers).toContainText('upcoming or in-progress booking');
    const u = await prisma.user.findUniqueOrThrow({ where: { id: ids.cleaner } });
    expect(u.accountStatus).toBe('ACTIVE');
  });

  test('a payout still in flight blocks deletion, named', async ({ page }) => {
    await booking({
      status: 'COMPLETED',
      date: londonSlot(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)).date,
      startTime: '10:00',
      transferStatus: 'PENDING',
      completedAt: new Date(),
    });
    await asCleaner(page);
    await page.goto('/cleaner/delete-account');
    await page.getByTestId('delete-account-confirm').fill('DELETE');
    await page.getByTestId('delete-account-password').fill(FIXTURE_PASSWORD);
    await page.getByTestId('delete-account-submit').click();
    await expect(page.getByTestId('delete-account-blockers')).toContainText(
      'payout still in flight'
    );
    const u = await prisma.user.findUniqueOrThrow({ where: { id: ids.cleaner } });
    expect(u.accountStatus).toBe('ACTIVE');
  });

  test('Stripe return room: connected and unfinished states (no Stripe call needed)', async ({
    page,
  }) => {
    await asCleaner(page);
    await page
      .context()
      .addCookies([{ name: 'rena-app-preview', value: '1', url: 'http://localhost:3000' }]);
    await page.goto('/app/stripe-return');
    await expect(page.getByTestId('stripe-return-shell')).toBeVisible();
    await expect(page.getByTestId('stripe-return-unfinished')).toHaveCount(0);

    const profile = await prisma.cleanerProfile.findUniqueOrThrow({
      where: { userId: ids.cleaner },
      select: { stripeChargesEnabled: true, stripePayoutsEnabled: true, stripeAccountId: true },
    });
    await prisma.cleanerProfile.update({
      where: { userId: ids.cleaner },
      data: { stripeChargesEnabled: false, stripePayoutsEnabled: false, stripeAccountId: null },
    });
    try {
      await page.goto('/app/stripe-return');
      await expect(page.getByTestId('stripe-return-unfinished')).toBeVisible();
    } finally {
      await prisma.cleanerProfile.update({ where: { userId: ids.cleaner }, data: profile });
    }
  });
});
