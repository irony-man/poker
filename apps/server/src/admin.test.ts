import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isAdminUsername, parseAdminUsernames } from './admin/admin-allowlist.js';
import { AuthStore } from './auth/auth.store.js';
import { MemoryKv } from './kv/kv.store.js';
import { memoryHistoryStore, type HandHistoryStore } from './history/history.store.js';
import { RoomManager } from './rooms/room.js';
import { SiteConfigStore } from './site-config/site-config.store.js';
import { MemoryTableChipStore } from './table-chips/table-chips.store.js';
import { TournamentManager } from './contests/tournament.js';
import { AuthWalletStore } from './wallet/wallet.store.js';
import {
  STARTING_CHIP_GRANT,
  STARTING_WHUFFIE_GRANT,
  WalletError,
} from './wallet/wallet.constants.js';

function memoryHistory(): HandHistoryStore {
  return memoryHistoryStore();
}

describe('admin allowlist', () => {
  it('parses usernames and fails closed when empty', () => {
    expect(parseAdminUsernames(undefined).size).toBe(0);
    expect(parseAdminUsernames('').size).toBe(0);
    expect(parseAdminUsernames(' alice, Bob ')).toEqual(new Set(['alice', 'bob']));
    expect(isAdminUsername('Alice', parseAdminUsernames('alice,bob'))).toBe(true);
    expect(isAdminUsername('charlie', parseAdminUsernames('alice,bob'))).toBe(false);
    expect(isAdminUsername('alice', parseAdminUsernames(null))).toBe(false);
  });
});

describe('site config + runtime economy', () => {
  let dir: string;
  let site: SiteConfigStore;
  let auth: AuthStore;
  let wallet: AuthWalletStore;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'admin-'));
    site = new SiteConfigStore(dir);
    await site.init();
    auth = new AuthStore(dir);
    auth.setEconomyProvider(() => site.getEconomy());
    await auth.init();
    wallet = new AuthWalletStore(auth);
    wallet.setEconomyProvider(() => site.getEconomy());
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('defaults match wallet constants', () => {
    const eco = site.getEconomy();
    expect(eco.startingChipGrant).toBe(STARTING_CHIP_GRANT);
    expect(eco.startingWhuffieGrant).toBe(STARTING_WHUFFIE_GRANT);
  });

  it('signup uses configured starting grants', async () => {
    await site.setEconomy({ startingChipGrant: 42_000, startingWhuffieGrant: 100 });
    const session = await auth.signup('newbie', 'password12');
    expect(session.chipBalance).toBe(42_000);
    expect(session.whuffieBalance).toBe(100);
    expect(wallet.getBalance(session.userId)).toBe(42_000);
    expect(wallet.getWhuffieBalance(session.userId)).toBe(100);
  });

  it('refill respects configured threshold and grant', async () => {
    await auth.seedUser('u1', 'alice', 'password1');
    await site.setEconomy({ refillThreshold: 2_000, refillGrant: 7_000 });
    await wallet.debit('u1', STARTING_CHIP_GRANT - 1_500, 'buy_in');
    expect(wallet.getBalance('u1')).toBe(1_500);
    expect(wallet.refillInfo('u1').eligible).toBe(true);
    const after = await wallet.claimRefill('u1');
    expect(after.balance).toBe(1_500 + 7_000);
  });

  it('admin_credit increases balance', async () => {
    await auth.seedUser('u1', 'alice', 'password1');
    const before = wallet.getBalance('u1');
    const res = await wallet.credit('u1', 500, 'admin_credit');
    expect(res.balance).toBe(before + 500);
  });

  it('rejects claim above runtime threshold', async () => {
    await auth.seedUser('u1', 'alice', 'password1');
    await site.setEconomy({ refillThreshold: 100 });
    await expect(wallet.claimRefill('u1')).rejects.toBeInstanceOf(WalletError);
  });

  it('persists announcement to file', async () => {
    await site.setAnnouncement({ enabled: true, text: 'Hello players' });
    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getAnnouncement()).toEqual({ enabled: true, text: 'Hello players' });
  });

  it('persists home landing features', async () => {
    const features = site.getHomeFeatures();
    expect(features.length).toBeGreaterThanOrEqual(5);
    features[0] = { ...features[0]!, title: 'Edited Contests' };
    await site.setHomeFeatures(features);
    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getHomeFeatures()[0]!.title).toBe('Edited Contests');
  });

  it('persists pages copy', async () => {
    const pages = site.getPages();
    pages.host = { title: 'Host now', subtitle: 'Custom host blurb' };
    await site.setPages(pages);
    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getPages().host.title).toBe('Host now');
  });

  it('seeds arcade copy from classic when by-theme keys are missing', async () => {
    await writeFile(
      path.join(dir, 'site-config.json'),
      JSON.stringify({
        pages: {
          host: { title: 'Custom Classic Host', subtitle: 'Classic host blurb' },
        },
        homeFeatures: [
          {
            title: 'Classic Contests',
            body: 'Classic body',
            cta: 'Go',
            href: '/contests',
            image: '/home-knockout.png',
            imageAlt: 'alt',
            imageFirst: true,
          },
        ],
      }),
    );
    const seeded = new SiteConfigStore(dir);
    await seeded.init();
    expect(seeded.getPages('v1').host.title).toBe('Custom Classic Host');
    expect(seeded.getPages('v2').host.title).toBe('Custom Classic Host');
    expect(seeded.getHomeFeatures('v1')[0]!.title).toBe('Classic Contests');
    expect(seeded.getHomeFeatures('v2')[0]!.title).toBe('Classic Contests');
  });

  it('theme-scoped pages PATCH does not overwrite the other look', async () => {
    const classic = site.getPages('v1');
    classic.host = { title: 'Classic host', subtitle: 'Classic blurb' };
    await site.setPages(classic, 'v1');

    const arcade = site.getPages('v2');
    arcade.host = { title: 'Arcade host', subtitle: 'Arcade blurb' };
    await site.setPages(arcade, 'v2');

    expect(site.getPages('v1').host.title).toBe('Classic host');
    expect(site.getPages('v2').host.title).toBe('Arcade host');
    expect(site.getPages().host.title).toBe('Classic host');

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getPages('v1').host.title).toBe('Classic host');
    expect(reloaded.getPages('v2').host.title).toBe('Arcade host');
  });

  it('theme-scoped home-features PATCH does not overwrite the other look', async () => {
    const classic = site.getHomeFeatures('v1');
    classic[0] = { ...classic[0]!, title: 'Classic Contests' };
    await site.setHomeFeatures(classic, 'v1');

    const arcade = site.getHomeFeatures('v2');
    arcade[0] = { ...arcade[0]!, title: 'Arcade Contests' };
    await site.setHomeFeatures(arcade, 'v2');

    expect(site.getHomeFeatures('v1')[0]!.title).toBe('Classic Contests');
    expect(site.getHomeFeatures('v2')[0]!.title).toBe('Arcade Contests');
    expect(site.getHomeFeatures()[0]!.title).toBe('Classic Contests');

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getHomeFeatures('v1')[0]!.title).toBe('Classic Contests');
    expect(reloaded.getHomeFeatures('v2')[0]!.title).toBe('Arcade Contests');
  });

  it('persists room inactivity minutes', async () => {
    await site.setRoomSettings({ inactivityMinutes: 45 });
    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getRoomSettings().inactivityMinutes).toBe(45);
  });

  it('defaults and persists bot name groups', async () => {
    const groups = site.getBotGroups();
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups.some((g) => g.isDefault)).toBe(true);
    expect(site.getBotNamePool().length).toBeGreaterThan(0);

    await site.setBotGroups([
      {
        id: 'friends',
        name: 'Friendly table',
        names: ['Buddy', 'Pal', 'Mate'],
        isDefault: true,
        defaultPersonality: 'passive',
        namePersonalities: { Buddy: 'aggro' },
      },
      {
        id: 'villains',
        name: 'Villains',
        names: ['BluffKing', 'RiverGod'],
        isDefault: false,
        defaultPersonality: 'maniac',
        namePersonalities: {},
      },
    ]);
    expect(site.getBotNamePool()).toEqual(['Buddy', 'Pal', 'Mate']);
    expect(site.getBotNamePool('villains')).toEqual(['BluffKing', 'RiverGod']);
    expect(site.getBotSeatingConfig().defaultPersonality).toBe('passive');
    expect(site.getBotSeatingConfig().namePersonalities.Buddy).toBe('aggro');
    expect(site.getBotSeatingConfig('villains').defaultPersonality).toBe('maniac');

    const reloaded = new SiteConfigStore(dir);
    await reloaded.init();
    expect(reloaded.getBotGroups()).toHaveLength(2);
    expect(reloaded.getBotNamePool('friends')[0]).toBe('Buddy');
    expect(reloaded.getBotSeatingConfig('friends').namePersonalities.Buddy).toBe('aggro');
  });
});

describe('admin live games listing', () => {
  it('lists private rooms and all contests', async () => {
    const rooms = new RoomManager(
      new MemoryKv(),
      memoryHistory(),
      new MemoryTableChipStore(),
    );
    const meta = rooms.create({
      name: 'Private Game',
      hostUserId: 'host1',
      isPrivate: true,
      config: {
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
        maxSeats: 6,
      },
    });
    rooms.create({
      name: 'Low stakes',
      hostUserId: 'house',
      isPrivate: false,
      stakeId: 'low',
      config: {
        smallBlind: 5,
        bigBlind: 10,
        buyIn: 1000,
        turnTimeMs: 20_000,
        maxSeats: 6,
      },
    });
    const all = rooms.listAllAdmin();
    expect(all.some((t) => t.tableId === meta.id && t.isPrivate)).toBe(true);
    expect(all.every((t) => t.isPrivate || !t.stakeId)).toBe(true);

    const tm = new TournamentManager(rooms);
    await tm.create({
      name: 'Cup',
      mode: 'chips',
      hostUserId: 'host1',
      hostName: 'Host',
      fieldSize: 4,
      startingStack: 1000,
      smallBlind: 5,
      bigBlind: 10,
      turnTimeMs: 20_000,
      botCount: 0,
      isPrivate: true,
      autoStart: false,
    });
    const contests = tm.listAll();
    expect(contests).toHaveLength(1);
    expect(contests[0]!.isPrivate).toBe(true);
    expect(tm.listPublic()).toHaveLength(0);
    expect(tm.listLive()).toHaveLength(1);
  });
});
