import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { dataSourceAsQueryable } from '../database/queryable.js';
import type { EconomySnapshot } from '../wallet/wallet.constants.js';
import { SiteConfigStore } from './site-config.store.js';
import type {
  BotGroup,
  BotGroupLabels,
  BotSeatingConfig,
  CopyTheme,
  HomeFeaturesByTheme,
  HomeLandingFeature,
  PagesByTheme,
  PagesCopy,
  RoomSettings,
  AvatarPresetsConfig,
  SiteAnnouncement,
  SiteConfigPayload,
  TableSoundsConfig,
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

  getHomeFeatures(theme?: CopyTheme): HomeLandingFeature[] {
    return this.store.getHomeFeatures(theme);
  }

  getHomeFeaturesByTheme(): HomeFeaturesByTheme {
    return this.store.getHomeFeaturesByTheme();
  }

  getPages(theme?: CopyTheme): PagesCopy {
    return this.store.getPages(theme);
  }

  getPagesByTheme(): PagesByTheme {
    return this.store.getPagesByTheme();
  }

  getRoomSettings(): RoomSettings {
    return this.store.getRoomSettings();
  }

  getBotGroups(): BotGroup[] {
    return this.store.getBotGroups();
  }

  getBotGroupLabels(): BotGroupLabels {
    return this.store.getBotGroupLabels();
  }

  getSounds(): TableSoundsConfig {
    return this.store.getSounds();
  }

  getAvatarPresets(): AvatarPresetsConfig {
    return this.store.getAvatarPresets();
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

  setHomeFeatures(
    features: HomeLandingFeature[],
    theme?: CopyTheme,
  ): Promise<HomeLandingFeature[]> {
    return this.store.setHomeFeatures(features, theme);
  }

  setPages(pages: PagesCopy, theme?: CopyTheme): Promise<PagesCopy> {
    return this.store.setPages(pages, theme);
  }

  setRoomSettings(partial: Partial<RoomSettings>): Promise<RoomSettings> {
    return this.store.setRoomSettings(partial);
  }

  setBotGroups(
    groups: BotGroup[],
    labels?: BotGroupLabels | null,
  ): Promise<{ groups: BotGroup[]; labels: BotGroupLabels }> {
    return this.store.setBotGroups(groups, labels);
  }

  setSounds(next: TableSoundsConfig): Promise<TableSoundsConfig> {
    return this.store.setSounds(next);
  }

  setAvatarPresets(next: AvatarPresetsConfig): Promise<AvatarPresetsConfig> {
    return this.store.setAvatarPresets(next);
  }
}
