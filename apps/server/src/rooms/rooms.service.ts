import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { TableConfig } from '@poker/engine';
import { HistoryService } from '../history/history.service.js';
import { KvService } from '../kv/kv.service.js';
import { ensurePublicTables } from '../public-tables/public-tables.js';
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
  ) {}

  onModuleInit(): void {
    this.manager = new RoomManager(
      this.kv.asStore(),
      this.history.asStore(),
      this.chips.asStore(),
      this.wallet.asStore(),
    );
    // Drop abandoned private/public tables; re-seed stake lobbies if needed.
    this.idleSweepTimer = setInterval(() => {
      this.manager.terminateIdleRooms();
      ensurePublicTables(this.manager);
    }, ROOM_IDLE_SWEEP_MS);
    this.idleSweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
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

  terminateIdleRooms() {
    return this.manager.terminateIdleRooms();
  }
}
