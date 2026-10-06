import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_UI_LOOKS } from '@poker/protocol';
import { AdminController } from '../admin/admin.controller.js';
import { AuthStore } from '../auth/auth.store.js';
import { SiteConfigStore } from './site-config.store.js';
import { normalizeSiteConfig } from './site-config.types.js';

function adminController(site: SiteConfigStore): AdminController {
  const none = {} as never;
  return new AdminController(
    site as never,
    none,
    none,
    none,
    none,
    none,
    none,
    none,
    none,
    none,
    none,
  );
}

describe('app looks site config', () => {
  let dir: string;
  let site: SiteConfigStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'site-ui-looks-'));
    site = new SiteConfigStore(dir);
    await site.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('seeds every look for snapshots saved before the field existed', () => {
    expect(normalizeSiteConfig({ announcement: { enabled: false, text: '' } }).uiLooks).toEqual(
      DEFAULT_UI_LOOKS,
    );
  });

  it('admin PATCH persists visibility and default', async () => {
    const saved = await adminController(site).patchUiLooks({
      visible: ['v2', 'v3'],
      defaultLook: 'v3',
    });
    expect(saved).toEqual({ visible: ['v2', 'v3'], defaultLook: 'v3' });

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getUiLooks()).toEqual({ visible: ['v2', 'v3'], defaultLook: 'v3' });
  });

  it('admin PATCH rejects an empty list or a hidden default', async () => {
    const controller = adminController(site);
    await expect(
      controller.patchUiLooks({ visible: [], defaultLook: 'v1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.patchUiLooks({ visible: ['v2'], defaultLook: 'v1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('new accounts start on the admin default look', async () => {
    await site.setUiLooks({ visible: ['v1', 'v2'], defaultLook: 'v2' });
    const auth = new AuthStore(dir);
    auth.setDefaultUiThemeProvider(() => site.getUiLooks().defaultLook);
    await auth.init();
    const session = await auth.signup('lookfan', 'password12');
    expect(auth.getUser(session.userId)?.uiTheme).toBe('v2');
  });
});
