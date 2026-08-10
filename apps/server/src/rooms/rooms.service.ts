import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type { TableConfig } from '@poker/engine';
import { HistoryService } from '../history/history.service.js';
import { KvService } from '../kv/kv.service.js';
import { ensurePublicTables } from '../public-tables/public-tables.js';
import { RealtimeService } from '../realtime/realtime.service.js';
import { TableChipsService } from '../table-chips/table-chips.service.js';
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
export class RoomsService implements OnModuleInit, OnModuleDestroy {
  private manager!: RoomManager;
  private idleSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly kv: KvService,
    private readonly history: HistoryService,
    private readonly chips: TableChipsService,
    private readonly wallet: WalletService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  onModuleInit(): void {
    this.manager = new RoomManager(
      this.kv.asStore(),
      this.history.asStore(),
      this.chips.asStore(),
      this.wallet.asStore(),
    );
    this.manager.setPublicLobbyChangeHandler(() => this.pushPublicTables());
    // Drop abandoned private/public tables; re-seed stake lobbies if needed.
    this.idleSweepTimer = setInterval(() => {
      this.manager.terminateIdleRooms();
      ensurePublicTables(this.manager);
      this.pushPublicTables();
    }, ROOM_IDLE_SWEEP_MS);
    this.idleSweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
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
    stakeId?: string;
    inviteCode?: string;
    tournament?: TournamentTableRules;
    playMoney?: boolean;
  }): TableMeta {
    return this.manager.create(opts);
  }

  get(tableId: string) {
    return this.manager.get(tableId);
  }

  getByInvite(code: string) {
    return this.manager.getByInvite(code);
  }

  findPublicByStake(stakeId: string) {
    return this.manager.findPublicByStake(stakeId);
  }

  listPublicLobby() {
    return this.manager.listPublicLobby();
  }

  listAllAdmin() {
    return this.manager.listAllAdmin();
  }

  terminateIdleRooms() {
    return this.manager.terminateIdleRooms();
  }
}
