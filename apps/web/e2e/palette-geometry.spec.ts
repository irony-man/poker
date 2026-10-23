import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { expect, test, type Page } from '@playwright/test';

const looks = [
  { id: 'v1', storage: null },
  { id: 'v2', storage: 'v2' },
  { id: 'v3', storage: 'v3' },
] as const;

const viewports = [
  { name: '390x844', width: 390, height: 844 },
  { name: '844x390', width: 844, height: 390 },
  { name: '1440x900', width: 1440, height: 900 },
] as const;

const routes: { path: string; auth: boolean; label: string }[] = [
  { path: '/', auth: false, label: 'home' },
  { path: '/play', auth: true, label: 'play' },
  { path: '/public', auth: false, label: 'public' },
  { path: '/friends', auth: true, label: 'friends' },
  { path: '/profile', auth: true, label: 'profile' },
  { path: '/sign-in', auth: false, label: 'sign-in' },
  { path: '/offline', auth: false, label: 'offline' },
  { path: '/solo', auth: true, label: 'solo' },
  { path: '/courtpiece', auth: false, label: 'courtpiece' },
  { path: '/ludo', auth: false, label: 'ludo' },
  { path: '/snakes', auth: false, label: 'snakes' },
  { path: '/memory', auth: false, label: 'memory' },
  { path: '/contests', auth: false, label: 'contests' },
  { path: '/privacy', auth: false, label: 'privacy' },
];

const gallery = path.join(process.cwd(), 'e2e/palette-gallery');

const maskCss = `
  * { color: transparent !important; background: transparent !important; background-image: none !important;
      border-color: #000 !important; outline-color: #000 !important; box-shadow: none !important;
      text-shadow: none !important; caret-color: transparent !important; }
  img, canvas, video, svg { visibility: hidden !important; }
`;

async function prepare(page: Page, look: (typeof looks)[number], palette: 'v1' | 'v2') {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(
    ({ theme, palette: next }) => {
      try {
        if (theme) localStorage.setItem('pokr-ui-theme', theme);
        else localStorage.removeItem('pokr-ui-theme');
        localStorage.setItem('pokr-palette', next);
      } catch {
        /* ignore */
      }
    },
    { theme: look.storage, palette },
  );
  await page.clock.install({ time: new Date('2026-01-15T12:00:00Z') });
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const rows: string[] = [];
    const nodes = document.body.querySelectorAll('*');
    nodes.forEach((node) => {
      const el = node as HTMLElement;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) return;
      const shadow = style.boxShadow === 'none' ? 'none' : style.boxShadow.replace(/rgba?\([^)]*\)/g, 'rgb()').replace(/#[0-9a-fA-F]{3,8}/g, '#');
      rows.push(
        [
          el.tagName,
          el.className?.toString?.() ?? '',
          box.x.toFixed(2),
          box.y.toFixed(2),
          box.width.toFixed(2),
          box.height.toFixed(2),
          style.fontFamily,
          style.fontSize,
          style.fontWeight,
          style.borderTopWidth,
          style.borderRightWidth,
          style.borderBottomWidth,
          style.borderLeftWidth,
          style.borderRadius,
          shadow,
          (el.innerText ?? '').slice(0, 80),
        ].join('|'),
      );
    });
    return rows.join('\n');
  });
}

async function maskedShot(page: Page) {
  await page.addStyleTag({ content: maskCss });
  const buffer = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  return PNG.sync.read(buffer);
}

test.describe('palette geometry', () => {
  test.beforeAll(() => {
    mkdirSync(gallery, { recursive: true });
  });

  for (const route of routes) {
    for (const look of looks) {
      for (const viewport of viewports) {
        const title = `${route.label} ${look.id} ${viewport.name}`;
        test(title, async ({ page }) => {
          test.skip(route.auth && !process.env.E2E_STORAGE_STATE, 'needs E2E_STORAGE_STATE for a signed-in session');
          if (process.env.E2E_STORAGE_STATE) {
            /* storage state is applied by the project when configured */
          }
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await prepare(page, look, 'v1');
          const offUrl = `${route.path}${route.path.includes('?') ? '&' : '?'}palette=v1`;
          const response = await page.goto(offUrl, { waitUntil: 'networkidle' });
          test.skip(!response || response.status() >= 500, `route unavailable (${response?.status()})`);
          await page.evaluate(() => document.fonts.ready);
          const offGeometry = await geometry(page);
          const offColour = await page.screenshot({ animations: 'disabled', caret: 'hide' });
          const offMasked = await maskedShot(page);

          await page.goto(`${route.path}?palette=v2`, { waitUntil: 'networkidle' });
          await page.evaluate(() => document.fonts.ready);
          const onGeometry = await geometry(page);
          const onColour = await page.screenshot({ animations: 'disabled', caret: 'hide' });
          const onMasked = await maskedShot(page);

          expect(onGeometry).toBe(offGeometry);
          const diff = new PNG({ width: offMasked.width, height: offMasked.height });
          const mismatched = pixelmatch(offMasked.data, onMasked.data, diff.data, offMasked.width, offMasked.height, {
            threshold: 0,
          });
          const stem = `${route.label}-${look.id}-${viewport.name}`;
          writeFileSync(path.join(gallery, `${stem}-off.png`), offColour);
          writeFileSync(path.join(gallery, `${stem}-on.png`), onColour);
          writeFileSync(path.join(gallery, `${stem}-mask-diff.png`), PNG.sync.write(diff));
          expect(mismatched).toBe(0);
        });
      }
    }
  }
});
