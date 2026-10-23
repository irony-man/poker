import { writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { expect, test } from '@playwright/test';

const routes = ['/', '/profile', '/friends', '/contests', '/courtpiece', '/ludo'];

async function settle(page: import('@playwright/test').Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important} nextjs-portal,.recent-chat-ticker{display:none!important}',
  });
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
}

async function stablePng(page: import('@playwright/test').Page) {
  await settle(page);
  let current = PNG.sync.read(await page.screenshot());
  for (let i = 0; i < 8; i += 1) {
    await page.waitForTimeout(400);
    const next = PNG.sync.read(await page.screenshot());
    if (next.width !== current.width || next.height !== current.height) {
      current = next;
      continue;
    }
    const delta = pixelmatch(current.data, next.data, null, current.width, current.height, { threshold: 0.1 });
    current = next;
    if (delta === 0) break;
  }
  return current;
}

test('non-poker routes ignore the poker flag', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of routes) {
    await page.goto(`${route}?pkv2=0`);
    const off = await stablePng(page);
    await page.goto(`${route}?pkv2=1`);
    const on = await stablePng(page);
    expect(off.width).toBe(on.width);
    expect(off.height).toBe(on.height);
    const diffPng = new PNG({ width: off.width, height: off.height });
    const diff = pixelmatch(off.data, on.data, diffPng.data, off.width, off.height, { threshold: 0.1 });
    if (diff > 0) {
      const slug = route.replace(/\W/g, '') || 'home';
      writeFileSync(`/tmp/pk-off-${slug}.png`, PNG.sync.write(off));
      writeFileSync(`/tmp/pk-on-${slug}.png`, PNG.sync.write(on));
      writeFileSync(`/tmp/pk-diff-${slug}.png`, PNG.sync.write(diffPng));
    }
    expect(diff, route).toBe(0);
  }
});
