import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { EconomySnapshot } from '../wallet/wallet.constants.js';
import { SiteConfigStore } from './site-config.store.js';
import type {
  BotGroup,
  BotSeatingConfig,
  HomeLandingFeature,
  PagesCopy,
  RoomSettings,
  SiteAnnouncement,
  SiteConfigPayload,
} from './site-config.types.js';

@Injectable()
export class SiteConfigService implements OnModuleInit {
  private readonly store: SiteConfigStore;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    const dataDir = this.config.get<string>('DATA_DIR') ?? `${process.cwd()}/data`;
    this.store = new SiteConfigStore(dataDir);
    this.store.setPool(dataSourceAsQueryable(this.dataSource));
  }

  async onModuleInit(): Promise<void> {
    await this.store.init();
  }

  /** Unit-test escape hatch. */
  asStore(): SiteConfigStore {
    return this.store;
  }

  getSnapshot(): SiteConfigPayload {
    return this.store.getSnapshot();
  }

  getAnnouncement(): SiteAnnouncement {
    return this.store.getAnnouncement();
  }

  getEconomy(): EconomySnapshot {
    return this.store.getEconomy();
  }

  getHomeFeatures(): HomeLandingFeature[] {
    return this.store.getHomeFeatures();
  }

  getPages(): PagesCopy {
    return this.store.getPages();
  }

  getRoomSettings(): RoomSettings {
    return this.store.getRoomSettings();
  }

  getBotGroups(): BotGroup[] {
    return this.store.getBotGroups();
  }

  getBotNamePool(groupId?: string | null): string[] {
    return this.store.getBotNamePool(groupId);
  }

  getBotSeatingConfig(groupId?: string | null): BotSeatingConfig {
    return this.store.getBotSeatingConfig(groupId);
  }

  /** Idle timeout in ms for terminate sweeps (derived). */
  getRoomInactivityMs(): number {
    return Math.max(60_000, this.store.getRoomSettings().inactivityMinutes * 60_000);
  }

  setAnnouncement(next: SiteAnnouncement): Promise<SiteAnnouncement> {
    return this.store.setAnnouncement(next);
  }

  setEconomy(partial: Partial<EconomySnapshot>): Promise<EconomySnapshot> {
    return this.store.setEconomy(partial);
  }

  setHomeFeatures(features: HomeLandingFeature[]): Promise<HomeLandingFeature[]> {
    return this.store.setHomeFeatures(features);
  }

  setPages(pages: PagesCopy): Promise<PagesCopy> {
    return this.store.setPages(pages);
  }

  setRoomSettings(partial: Partial<RoomSettings>): Promise<RoomSettings> {
    return this.store.setRoomSettings(partial);
  }

  setBotGroups(groups: BotGroup[]): Promise<BotGroup[]> {
    return this.store.setBotGroups(groups);
  }
}
