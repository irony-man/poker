import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOBBY_NAV } from '@poker/protocol';
import { AdminController } from '../admin/admin.controller.js';
import { BotChatController } from '../bot/bot-chat.controller.js';
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

describe('lobby nav site config', () => {
  let dir: string;
  let site: SiteConfigStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'site-lobby-nav-'));
    site = new SiteConfigStore(dir);
    await site.init();
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('seeds defaults for snapshots saved before the field existed', () => {
    expect(normalizeSiteConfig({ announcement: { enabled: false, text: '' } }).lobbyNav).toEqual(
      DEFAULT_LOBBY_NAV,
    );
    expect(site.isLobbyNavVisible('chat')).toBe(false);
  });

  it('admin PATCH persists order and visibility', async () => {
    const controller = adminController(site);
    const res = await controller.patchLobbyNav({
      items: [
        { id: 'chat', visible: true },
        { id: 'contests', visible: false },
      ],
    });
    expect(res.items.slice(0, 2)).toEqual([
      { id: 'chat', visible: true },
      { id: 'contests', visible: false },
    ]);
    expect(res.items).toHaveLength(DEFAULT_LOBBY_NAV.length);

    const raw = JSON.parse(await readFile(path.join(dir, 'site-config.json'), 'utf8'));
    expect(raw.lobbyNav[0]).toEqual({ id: 'chat', visible: true });

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.isLobbyNavVisible('chat')).toBe(true);
    expect(reloaded.isLobbyNavVisible('contests')).toBe(false);
    expect(adminController(reloaded).getLobbyNav().items[1]).toEqual({
      id: 'contests',
      visible: false,
    });
  });

  it('admin PATCH rejects unknown ids and duplicates', async () => {
    const controller = adminController(site);
    await expect(
      controller.patchLobbyNav({ items: [{ id: 'casino', visible: true }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      controller.patchLobbyNav({
        items: [
          { id: 'chat', visible: true },
          { id: 'chat', visible: false },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('BotChatController when chat is hidden', () => {
  function controller(chatVisible: boolean): BotChatController {
    const chat = { listProviders: () => ['cohere'] };
    const site = {
      isLobbyNavVisible: (id: string) => (id === 'chat' ? chatVisible : true),
      getBotChatStarters: () => [],
    };
    return new BotChatController(chat as never, site as never);
  }

  it('returns 404 from providers and create', async () => {
    const c = controller(false);
    expect(() => c.listProviders({} as never)).toThrow(NotFoundException);
    await expect(c.create({} as never, {}, {} as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('serves providers when chat is visible', () => {
    expect(controller(true).listProviders({} as never).providers).toEqual(['cohere']);
  });
});
