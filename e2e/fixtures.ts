import { expect, type Page } from '@playwright/test';

import { FIXTURE_PASSWORD, FIXTURES } from './global-setup';

export { FIXTURES };

let bucket = 0;
/**
 * The global API limiter (300 a minute per client IP) sees every spec as one
 * client on a single machine. A per-test documentation address (TEST-NET-3)
 * in X-Forwarded-For keeps each test in its own bucket, as distinct people
 * would be. The rig and CI run without a proxy in front, so the rightmost
 * X-Forwarded-For is the client address the limiter reads.
 */
export async function isolateRateBucket(page: Page) {
  bucket = (bucket % 250) + 1;
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `203.0.113.${bucket}` });
}

/** True when the fixture accounts can exist (a database reached global setup). */
export const hasFixtures = !!process.env.DATABASE_URL;

/** Sign in through the real login form and wait for the role home. */
export async function signIn(page: Page, who: keyof typeof FIXTURES, callbackUrl?: string) {
  const path = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login';
  await page.goto(path);
  await page.fill('input[type="email"]', FIXTURES[who].email);
  await page.locator('input[type="password"]').first().fill(FIXTURE_PASSWORD);
  await page.locator('form button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
}

/** The fixture cleaner's user id (the id /book/[id] takes), read from the database. */
export async function fixtureCleanerId(): Promise<string> {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({
      where: { email: FIXTURES.cleaner.email },
      select: { id: true },
    });
    if (!u) throw new Error('fixture cleaner missing');
    return u.id;
  } finally {
    await prisma.$disconnect();
  }
}
