import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Queryable } from '../database/queryable.js';
import type { EconomySnapshot } from '../wallet/wallet.constants.js';
import {
  defaultSiteConfig,
  normalizeBotGroups,
  normalizeHomeFeatures,
  normalizePagesCopy,
  normalizeRoomSettings,
  normalizeSiteConfig,
  normalizeTableSounds,
  resolveBotNamePool,
  resolveBotSeatingConfig,
  type BotGroup,
  type BotSeatingConfig,
  type HomeLandingFeature,
  type PagesCopy,
  type RoomSettings,
  type SiteAnnouncement,
  type SiteConfigPayload,
  type TableSoundsConfig,
} from './site-config.types.js';

/** Durable site settings — Postgres `site_config` when pool is set, else data/site-config.json. */
export class SiteConfigStore {
  private cache: SiteConfigPayload = defaultSiteConfig();
  private loaded = false;
  private readonly filePath: string;
  private pool: Queryable | null = null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir = path.join(process.cwd(), 'data'), pool: Queryable | null = null) {
    this.filePath = path.join(dataDir, 'site-config.json');
    this.pool = pool;
  }

  setPool(pool: Queryable | null): void {
    this.pool = pool;
  }

  async init(): Promise<void> {
    await this.ensureLoaded();
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    if (this.pool) {
      await this.loadFromPostgres();
    } else {
      await this.loadFromFile();
    }
    this.loaded = true;
  }

  private async loadFromFile(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await readFile(this.filePath, 'utf8');
      this.cache = normalizeSiteConfig(JSON.parse(raw) as unknown);
    } catch {
      this.cache = defaultSiteConfig();
    }
  }

  private async loadFromPostgres(): Promise<void> {
    if (!this.pool) return;
    const res = await this.pool.query(`SELECT payload FROM site_config WHERE id = 'default'`);
    const row = res.rows[0] as { payload?: unknown } | undefined;
    if (row?.payload != null) {
      this.cache = normalizeSiteConfig(row.payload);
    } else {
      this.cache = defaultSiteConfig();
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const snap = this.cache;
    if (this.pool) {
      await this.pool.query(
        `INSERT INTO site_config (id, payload, updated_at)
         VALUES ('default', $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET
           payload = EXCLUDED.payload,
           updated_at = NOW()`,
        [JSON.stringify(snap)],
      );
      return;
    }
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(snap, null, 2), 'utf8');
  }

  private serialized(fn: () => Promise<void>): Promise<void> {
    const run = this.writeChain.then(fn, fn);
    this.writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  getSnapshot(): SiteConfigPayload {
    return {
      announcement: { ...this.cache.announcement },
      economy: { ...this.cache.economy },
      homeFeatures: this.cache.homeFeatures.map((f) => ({ ...f })),
      pages: Object.fromEntries(
        Object.entries(this.cache.pages).map(([k, v]) => [k, { ...v }]),
      ) as PagesCopy,
      rooms: { ...this.cache.rooms },
      botGroups: this.cache.botGroups.map((g) => ({
        id: g.id,
        name: g.name,
        names: [...g.names],
        isDefault: g.isDefault,
        defaultPersonality: g.defaultPersonality,
        namePersonalities: { ...g.namePersonalities },
      })),
      sounds: {
        enabled: this.cache.sounds.enabled,
        urls: { ...this.cache.sounds.urls },
      },
    };
  }

  getAnnouncement(): SiteAnnouncement {
    return { ...this.cache.announcement };
  }

  getEconomy(): EconomySnapshot {
    return { ...this.cache.economy };
  }

  getHomeFeatures(): HomeLandingFeature[] {
    return this.cache.homeFeatures.map((f) => ({ ...f }));
  }

  getPages(): PagesCopy {
    return Object.fromEntries(
      Object.entries(this.cache.pages).map(([k, v]) => [k, { ...v }]),
    ) as PagesCopy;
  }

  getRoomSettings(): RoomSettings {
    return { ...this.cache.rooms };
  }

  getBotGroups(): BotGroup[] {
    return this.cache.botGroups.map((g) => ({
      id: g.id,
      name: g.name,
      names: [...g.names],
      isDefault: g.isDefault,
      defaultPersonality: g.defaultPersonality,
      namePersonalities: { ...g.namePersonalities },
    }));
  }

  getSounds(): TableSoundsConfig {
    return {
      enabled: this.cache.sounds.enabled,
      urls: { ...this.cache.sounds.urls },
    };
  }

  /** Display-name pool for seating; uses default group when id is missing. */
  getBotNamePool(groupId?: string | null): string[] {
    return resolveBotNamePool(this.cache.botGroups, groupId);
  }

  /** Name pool + personality styles for seating bots from a group. */
  getBotSeatingConfig(groupId?: string | null): BotSeatingConfig {
    return resolveBotSeatingConfig(this.cache.botGroups, groupId);
  }

  async setAnnouncement(next: SiteAnnouncement): Promise<SiteAnnouncement> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      announcement: {
        enabled: Boolean(next.enabled),
        text: typeof next.text === 'string' ? next.text.slice(0, 2000) : '',
      },
    };
    await this.serialized(() => this.persist());
    return this.getAnnouncement();
  }

  async setEconomy(partial: Partial<EconomySnapshot>): Promise<EconomySnapshot> {
    await this.ensureLoaded();
    const merged = normalizeSiteConfig({
      ...this.cache,
      economy: { ...this.cache.economy, ...partial },
    });
    this.cache = merged;
    await this.serialized(() => this.persist());
    return this.getEconomy();
  }

  async setHomeFeatures(features: HomeLandingFeature[]): Promise<HomeLandingFeature[]> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      homeFeatures: normalizeHomeFeatures(features),
    };
    await this.serialized(() => this.persist());
    return this.getHomeFeatures();
  }

  async setPages(pages: PagesCopy): Promise<PagesCopy> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      pages: normalizePagesCopy(pages),
    };
    await this.serialized(() => this.persist());
    return this.getPages();
  }

  async setRoomSettings(partial: Partial<RoomSettings>): Promise<RoomSettings> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      rooms: normalizeRoomSettings({ ...this.cache.rooms, ...partial }),
    };
    await this.serialized(() => this.persist());
    return this.getRoomSettings();
  }

  async setBotGroups(groups: BotGroup[]): Promise<BotGroup[]> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      botGroups: normalizeBotGroups(groups),
    };
    await this.serialized(() => this.persist());
    return this.getBotGroups();
  }

  async setSounds(next: TableSoundsConfig): Promise<TableSoundsConfig> {
    await this.ensureLoaded();
    this.cache = {
      ...this.cache,
      sounds: normalizeTableSounds(next),
    };
    await this.serialized(() => this.persist());
    return this.getSounds();
  }
}
