import { expect, test } from '@playwright/test';

const viewports = [
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test.describe('poker v2 screens', () => {
  for (const viewport of viewports) {
    test(`host lobby at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/play?pkv2=1');
      await expect(page.getByRole('heading', { name: 'Host a table' })).toBeVisible();
    });
  }

  test('join keeps a code field', async ({ page }) => {
    await page.goto('/play?mode=join&pkv2=1');
    await expect(page.getByRole('heading', { name: 'Join with code' })).toBeVisible();
    await expect(page.getByLabel('Invite code digit 1')).toBeVisible();
  });

  test('public, solo, and analysis guest', async ({ page }) => {
    await page.goto('/public?pkv2=1');
    await expect(page.getByRole('heading', { name: 'Public tables' })).toBeVisible();
    await page.goto('/solo?pkv2=1');
    await expect(page.getByRole('heading', { name: 'Offline arena' })).toBeVisible();
    await page.goto('/analysis?pkv2=1');
    await expect(page.getByRole('heading', { name: 'Analysis' })).toBeVisible();
  });

  test('flag off keeps the old host title', async ({ page }) => {
    await page.goto('/play?pkv2=0');
    await expect(page.locator('.pk-v2')).toHaveCount(0);
  });
});
