import { existsSync } from 'node:fs';
import path from 'node:path';
import { test } from '@playwright/test';

const frames = path.resolve(__dirname, '../../../../design/redesign-v2/frames');

test('desktop host frame is present for visual compare', async ({ page }) => {
  const file = path.join(frames, 'desktop/signed-in/02.png');
  test.skip(!existsSync(file), 'Figma PNG export was rate-limited; see design/redesign-v2/MANIFEST.md');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/play?pkv2=1');
  await page.screenshot({ path: path.join(frames, 'desktop/signed-in/02.actual.png') });
});
