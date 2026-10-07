import { expect, test, type Page, type Route } from '@playwright/test';

import { hasFixtures, isolateRateBucket, signIn } from './fixtures';

test.beforeEach(async ({ page }) => {
  await isolateRateBucket(page);
});

// RENA-084 mechanisms 1 and 2 (B2a): the way home from Messages.
test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

function trackPaths(page: Page): string[] {
  const seen: string[] = [];
  page.on('framenavigated', (f) => {
    if (f === page.mainFrame()) seen.push(new URL(f.url()).pathname);
  });
  return seen;
}

test('a cleaner never sees the customer way home, and Back returns to Messages', async ({
  page,
}) => {
  await signIn(page, 'cleaner');
  // Hold every role source so the role is unknown for a while: the session
  // read (this build) and the profile read the page used before B2a.
  const hold = async (route: Route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  };
  await page.route('**/api/auth/session', hold);
  await page.route('**/api/auth/profile', hold);
  const seen = trackPaths(page);
  await page.goto('/messages');
  // The first way home to appear, read at once (no retry): it must already be
  // the cleaner's, never a customer default that corrects itself later.
  const firstHome = page.getByRole('link', { name: /Back to (my account|dashboard)/ }).first();
  await expect(firstHome).toBeVisible({ timeout: 15000 });
  expect(await firstHome.textContent()).toMatch(/Back to dashboard/);
  const home = page.getByRole('link', { name: /Back to dashboard/ }).first();
  await expect(page.getByText('Back to my account')).toHaveCount(0);
  await page.unroute('**/api/auth/session');
  await page.unroute('**/api/auth/profile');
  await home.click();
  await expect(page).toHaveURL(/\/cleaner$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/messages$/);
  expect(seen).not.toContain('/account');
});

test('a customer is offered Back to my account', async ({ page }) => {
  await signIn(page, 'customerA');
  await page.goto('/messages');
  const home = page.getByRole('link', { name: /Back to my account/ }).first();
  await expect(home).toBeVisible({ timeout: 15000 });
  await home.click();
  await expect(page).toHaveURL(/\/account$/);
});

test('Back after a role redirect returns to where the person came from', async ({ page }) => {
  await signIn(page, 'customerA');
  await page.goto('/messages');
  await page.goto('/cleaner'); // the wrong role home: the guard replaces it with /account
  await expect(page).toHaveURL(/\/account$/, { timeout: 15000 });
  await page.goBack();
  await expect(page).toHaveURL(/\/messages$/);
});

const PARTNER = 'e2e-partner';
// The real API lists the signed-in person first under their own id
// (message.service.ts), so the stub does the same.
const conversationFor = (me: string) => ({
  id: PARTNER,
  participants: [
    { id: me, name: 'You', avatar: '', role: 'customer' },
    { id: PARTNER, name: 'Cleo Fixture', avatar: '', role: 'cleaner' },
  ],
  lastMessage: {
    id: 'm1',
    conversationId: PARTNER,
    senderId: PARTNER,
    content: 'See you Tuesday',
    read: true,
    createdAt: new Date().toISOString(),
  },
  unreadCount: 0,
  canSend: true,
  blockedByMe: false,
  updatedAt: new Date().toISOString(),
});

async function stubThread(page: Page) {
  const me = await page.evaluate(async () => {
    const res = await fetch('/api/auth/session');
    return ((await res.json()) as { user: { id: string } }).user.id;
  });
  const conversation = conversationFor(me);
  await page.route('**/api/messages', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ conversations: [conversation] }),
    })
  );
  await page.route(`**/api/messages/${PARTNER}*`, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ messages: [conversation.lastMessage] }),
    })
  );
}

test.describe('phone width thread history', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('Back closes the thread, Forward reopens it, no duplicate entries', async ({ page }) => {
    await signIn(page, 'customerA');
    await stubThread(page);
    await page.goto('/about');
    await page.goto('/messages');
    const row = page.getByText('Cleo Fixture').first();
    await row.click();
    const thread = page.getByText('See you Tuesday').last();
    await expect(thread).toBeVisible();
    // Re-opening the same thread pushes nothing new.
    const before = await page.evaluate(() => history.length);
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    expect(await page.evaluate(() => history.length)).toBe(before);
    await page.goBack();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(page.getByText('Cleo Fixture').first()).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/messages$/);
    await expect(page.getByLabel('Back to conversations')).toBeVisible();
    // The chevron spends the entry: one more Back leaves Messages.
    await page.getByLabel('Back to conversations').click();
    await expect(page.getByText('Cleo Fixture').first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
  });

  test('direct entry with a booking opens the thread; Back shows the list first', async ({
    page,
  }) => {
    await signIn(page, 'customerA');
    await stubThread(page);
    await page.route('**/api/messages/compose*', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          partnerId: PARTNER,
          partnerName: 'Cleo Fixture',
          partnerRole: 'cleaner',
          canSend: true,
          bookingId: 'bk_e2e',
          blockedByMe: false,
        }),
      })
    );
    await page.goto('/about');
    await page.goto('/messages?bookingId=bk_e2e');
    await expect(page.getByLabel('Back to conversations')).toBeVisible({ timeout: 15000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/messages\?bookingId=bk_e2e$/);
    await expect(page.getByText('Cleo Fixture').first()).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/about$/);
  });
});
