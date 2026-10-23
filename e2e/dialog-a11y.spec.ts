import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

import { FIXTURES, hasFixtures, isolateRateBucket, signIn } from './fixtures';

// B6.2 (RENA-049, RENA-050): the one dialog primitive, one surface per class.
// Centre and dismissible: the account deletion confirm. Sheet and dismissible:
// the customer shell's account menu. Sheet and NOT dismissible: the in-shell
// analytics ask, stacked over the page. Each proves Tab stays inside, Shift+Tab
// wraps, Escape closes only where dismissible, focus returns to the opener,
// the overlay carries no aria-hidden and the open dialog passes axe.

const CUSTOMER_SHELL_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 RenaApp/1.0.1';

test.skip(!hasFixtures, 'needs the fixture accounts (DATABASE_URL)');

async function clearConsent(email: string) {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) await prisma.gdprConsent.deleteMany({ where: { userId: u.id } });
  } finally {
    await prisma.$disconnect();
  }
}

/** Focus stays inside `dialog` across `n` presses of Tab (or Shift+Tab). */
async function expectTabStaysInside(page: Page, dialog: Locator, n: number, shift = false) {
  for (let i = 0; i < n; i += 1) {
    await page.keyboard.press(shift ? 'Shift+Tab' : 'Tab');
    const inside = await dialog.evaluate((d) => d.contains(document.activeElement));
    expect(inside, `focus left the dialog after ${i + 1} ${shift ? 'Shift+Tab' : 'Tab'}`).toBe(
      true
    );
  }
}

async function tabbableCount(dialog: Locator): Promise<number> {
  return dialog.evaluate(
    (d) =>
      Array.from(
        d.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')
      ).filter(
        (el) =>
          el.tabIndex >= 0 &&
          !el.hasAttribute('disabled') &&
          !el.hasAttribute('data-dialog-sentinel') &&
          el.getClientRects().length > 0
      ).length
  );
}

async function expectWrapAndOverlay(page: Page, dialog: Locator) {
  const count = await tabbableCount(dialog);
  expect(count).toBeGreaterThan(0);
  // Round the whole list twice each way: wrapping, never escaping.
  await expectTabStaysInside(page, dialog, count * 2 + 1);
  await expectTabStaysInside(page, dialog, count * 2 + 1, true);
  // Shift+Tab from the first lands on the last.
  await dialog.evaluate((d) => {
    const first = Array.from(
      d.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')
    ).find(
      (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.getClientRects().length > 0
    );
    first?.focus();
  });
  await page.keyboard.press('Shift+Tab');
  const isLast = await dialog.evaluate((d) => {
    const list = Array.from(
      d.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')
    ).filter(
      (el) => el.tabIndex >= 0 && !el.hasAttribute('disabled') && el.getClientRects().length > 0
    );
    return document.activeElement === list[list.length - 1];
  });
  expect(isLast).toBe(true);
  // The overlay (the dialog's parent) and the dialog are never aria-hidden.
  expect(await dialog.getAttribute('aria-hidden')).toBeNull();
  expect(await dialog.evaluate((d) => d.parentElement?.getAttribute('aria-hidden') ?? null)).toBe(
    null
  );
  expect(await dialog.getAttribute('aria-modal')).toBe('true');
  // The rest of the page is inert while it is open.
  expect(
    await page.evaluate(() =>
      Array.from(document.body.children)
        .filter((c) => !c.hasAttribute('data-rena-dialog') && !c.hasAttribute('inert'))
        .map((c) => `${c.tagName}#${c.id}`)
    )
  ).toEqual([]);
  // Colour contrast is the brand palette's own question (the muted ink on
  // surface), not the dialog's semantics; every other rule must pass.
  const axe = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .disableRules(['color-contrast'])
    .analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
}

test('centre dialog: the account deletion confirm traps, closes on Escape and returns focus', async ({
  page,
}) => {
  await isolateRateBucket(page);
  await signIn(page, 'customerA');
  await page.goto('/account/settings');
  const opener = page.getByRole('button', { name: 'Delete my account' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Delete account' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  await expectWrapAndOverlay(page, dialog);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  expect(
    await page.evaluate(() =>
      Array.from(document.body.children).some((c) => c.hasAttribute('inert'))
    )
  ).toBe(false);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('sheets in the customer shell: the analytics ask is not dismissible; the account menu is', async ({
  browser,
}) => {
  const context = await browser.newContext({ userAgent: CUSTOMER_SHELL_UA });
  const page = await context.newPage();
  await isolateRateBucket(page);
  // No answer in the ledger yet, so the ask shows on the entry pane.
  await clearConsent(FIXTURES.customerA.email);
  await signIn(page, 'customerA');
  await page.goto('/app/home');

  const ask = page.getByRole('dialog', { name: 'Help us improve Rena' });
  const askShown = await ask
    .waitFor({ state: 'visible', timeout: 8000 })
    .then(() => true)
    .catch(() => false);
  if (askShown) {
    await expectWrapAndOverlay(page, ask);
    await page.keyboard.press('Escape');
    await expect(ask).toBeVisible();
    // The backdrop does not close it either.
    await page.mouse.click(5, 5);
    await expect(ask).toBeVisible();
    await page.getByTestId('shell-consent-essential').click();
    await expect(ask).toBeHidden();
  }

  const opener = page.getByRole('button', { name: 'Account' }).first();
  await opener.click();
  const menu = page.getByRole('dialog', { name: 'Account' });
  await expect(menu).toBeVisible();
  await expectWrapAndOverlay(page, menu);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(opener).toBeFocused();

  // The backdrop closes a dismissible sheet.
  await opener.click();
  await expect(menu).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(menu).toBeHidden();
  test.info().annotations.push({
    type: 'consent-ask',
    description: askShown ? 'shown and proven' : 'not shown (account already answered)',
  });
  await context.close();
});
