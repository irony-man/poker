import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import type { TableConfig } from '@poker/engine';
import { BotBanterLlmService } from '../bot/bot-banter-llm.service.js';
import { PlayerExploitLlmService } from '../bot/player-exploit-llm.service.js';
import { HistoryService } from '../history/history.service.js';
import { KvService } from '../kv/kv.service.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import type { PublicTableTimingsMs } from '../site-config/site-config.types.js';
import { errorText } from '../common/error-text.js';
import { TableChipsService } from '../table-chips/table-chips.service.js';
import { TableStakesService } from '../table-chips/table-stakes.service.js';
import { recoverTableStakes } from '../table-chips/table-stakes.store.js';
import { tableGameRules } from '../wallet/wallet.constants.js';
import { WalletService } from '../wallet/wallet.service.js';
import {
  ROOM_IDLE_SWEEP_MS,
  RoomManager,
  type TableMeta,
  type TournamentHandEndedHook,
  type TournamentTableRules,
} from './room.js';

/**
 * Process-local multi-table host (wraps RoomManager).
 */
@Injectable()
export class RoomsService implements OnModuleInit, OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(RoomsService.name);
  private manager!: RoomManager;
  private idleSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly kv: KvService,
    private readonly history: HistoryService,
    private readonly chips: TableChipsService,
    private readonly siteConfig: SiteConfigService,
    private readonly wallet: WalletService,
    private readonly stakes: TableStakesService,
    @Optional() private readonly realtime?: RealtimeService,
    @Optional() private readonly banterLlm?: BotBanterLlmService,
    @Optional() private readonly exploitLlm?: PlayerExploitLlmService,
  ) {}

  onModuleInit(): void {
    this.manager = new RoomManager(
      this.kv.asStore(),
      this.history.asStore(),
      this.chips.asStore(),
      this.wallet.asStore(),
    );
    this.manager.setStakeStore(this.stakes.asStore());
    this.manager.setTableGameRules(() => tableGameRules(this.siteConfig.getEconomy()));
    if (this.banterLlm) this.manager.setBanterLlm(this.banterLlm);
    if (this.exploitLlm) this.manager.setExploitLlm(this.exploitLlm);
    this.manager.setPublicLobbyChangeHandler(() => this.pushPublicTables());
    // Drop abandoned private and matchmade public tables.
    this.idleSweepTimer = setInterval(() => {
      this.manager.terminateIdleRooms(Date.now(), this.siteConfig.getRoomInactivityMs());
      this.pushPublicTables();
    }, ROOM_IDLE_SWEEP_MS);
    this.idleSweepTimer.unref?.();
  }

  /** Runs after every module (users, wallet) is initialised and before the server listens. */
  async onApplicationBootstrap(): Promise<void> {
    try {
      const recovered = await recoverTableStakes(this.stakes.asStore(), this.wallet.asStore());
      if (recovered.refunded > 0 || recovered.failed > 0) {
        this.logger.warn(
          `Refunded ${recovered.chips} chips to ${recovered.refunded} seats left on tables by an unclean shutdown` +
            (recovered.failed > 0 ? ` (${recovered.failed} failed, will retry next boot)` : ''),
        );
      }
    } catch (err) {
      this.logger.error(`Table stake recovery failed: ${errorText(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
    await this.manager?.shutdownAll();
  }

  private pushPublicTables(): void {
    if (!this.realtime) return;
    this.realtime.schedulePublicTablesBroadcast(this.listPublicLobby());
  }

  asManager(): RoomManager {
    return this.manager;
  }

  setTournamentHook(hook: TournamentHandEndedHook | null): void {
    this.manager.setTournamentHook(hook);
  }

  create(opts: {
    name: string;
    hostUserId: string;
    config: TableConfig;
    isPrivate: boolean;
    matchmade?: boolean;
    stakeId?: string;
    timings?: PublicTableTimingsMs;
    inviteCode?: string;
    tournament?: TournamentTableRules;
    playMoney?: boolean;
    lobby?: boolean;
  }): TableMeta {
    return this.manager.create(opts);
  }

  get(tableId: string) {
    return this.manager.get(tableId);
  }

  getByInvite(code: string) {
    return this.manager.getByInvite(code);
  }

  listMatchmade() {
    return this.manager.listMatchmade();
  }

  listPublicLobby() {
    return this.manager.listPublicLobby();
  }

  listAllAdmin() {
    return this.manager.listAllAdmin(this.siteConfig.getRoomInactivityMs());
  }

  /** Vacate every live room this user is in (cash, public, contest). */
  leaveUser(userId: string) {
    this.manager.leaveUser(userId);
  }

  terminateIdleRooms(now?: number) {
    return this.manager.terminateIdleRooms(
      now ?? Date.now(),
      this.siteConfig.getRoomInactivityMs(),
    );
  }
}
