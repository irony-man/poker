import { expect, test } from '@playwright/test';

async function apiUp(): Promise<boolean> {
  try {
    const res = await fetch('http://127.0.0.1:4000/health');
    return res.ok;
  } catch {
    return false;
  }
}

test('offline hand, keyboard, and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/offline?pkv2=1&seats=6&name=Ada');
  await expect(page.getByRole('heading', { name: 'Offline table' })).toBeVisible();
  const fold = page.getByRole('button', { name: 'Fold' });
  for (let hand = 0; hand < 8 && !(await fold.isVisible()); hand += 1) {
    const start = page.getByRole('button', { name: 'Start hand' });
    const next = page.getByRole('button', { name: 'Next hand' });
    if (await start.isVisible()) await start.click();
    else if (await next.isVisible()) await next.click();
    await fold.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  }
  await expect(fold).toBeVisible();
  await page.keyboard.press('f');
  await expect(page.getByRole('heading', { name: 'Hand complete' })).toBeVisible();
});

test('reload mid-hand shows the table again', async ({ page }) => {
  await page.goto('/offline?pkv2=1&seats=2&name=Ada');
  await page.getByRole('button', { name: 'Start hand' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Offline table' })).toBeVisible();
});

test('guest gate from public sit', async ({ page }) => {
  await page.goto('/public?pkv2=1');
  await page.getByRole('button', { name: 'Sign in to sit' }).first().click();
  const gate = page.getByRole('dialog');
  await expect(gate.getByRole('heading', { name: 'Sign in to sit' })).toBeVisible();
  await expect(gate.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', /next=/);
});

test('host, spectate, and reconnect', async ({ page, browser }) => {
  test.skip(!(await apiUp()), 'API is not running');
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  await page.goto(`/sign-up?next=${encodeURIComponent('/play?pkv2=1')}`);
  await page.getByRole('textbox', { name: /^Username/ }).fill(`host${stamp}`);
  await page.getByRole('textbox', { name: /^Password/ }).fill('password1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Host a table' })).toBeVisible();
  await page.getByRole('tablist', { name: 'Seats' }).getByRole('tab', { name: '2' }).click();
  await page.getByRole('tablist', { name: 'Starting bots' }).getByRole('tab', { name: '1' }).click();
  await page.getByRole('button', { name: 'Create private table' }).click();
  await expect(page).toHaveURL(/\/table\//, { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 20_000 });
  const code = ((await page.getByText(/^Code /).textContent()) ?? '').replace(/\D/g, '');
  expect(code.length).toBeGreaterThanOrEqual(4);

  await page.locator('nextjs-portal').evaluate((node) => node.remove()).catch(() => undefined);
  await page.getByRole('button', { name: 'Start', exact: true }).evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(page.getByRole('button', { name: /Fold|Check|Call/ }).first()).toBeVisible({ timeout: 20_000 });

  await page.context().setOffline(true);
  await expect(page.getByText('Reconnecting')).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.getByText('Reconnecting')).toBeHidden({ timeout: 15_000 });

  const guest = await browser.newContext();
  const watcher = await guest.newPage();
  await watcher.goto(`/sign-up?next=${encodeURIComponent('/play?mode=join&pkv2=1')}`);
  await watcher.getByRole('textbox', { name: /^Username/ }).fill(`watch${stamp}`);
  await watcher.getByRole('textbox', { name: /^Password/ }).fill('password1');
  await watcher.getByRole('button', { name: 'Create account' }).click();
  await expect(watcher.getByRole('heading', { name: 'Join with code' })).toBeVisible();
  await watcher.getByLabel('Invite code digit 1').fill(code);
  await watcher.getByRole('button', { name: 'Watch' }).click();
  await expect(watcher).toHaveURL(/mode=spectate/);
  await expect(watcher.getByText('Spectating — you are not seated.')).toBeVisible({ timeout: 20_000 });
  await guest.close();
});
