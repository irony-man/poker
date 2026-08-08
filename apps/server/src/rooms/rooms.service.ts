import { Injectable, OnModuleInit } from '@nestjs/common';
import type { TableConfig } from '@poker/engine';
import { HistoryService } from '../history/history.service.js';
import { KvService } from '../kv/kv.service.js';
import { TableChipsService } from '../table-chips/table-chips.service.js';
import { WalletService } from '../wallet/wallet.service.js';
import { RoomManager, type TableMeta, type TournamentHandEndedHook, type TournamentTableRules } from './room.js';

/**
 * Process-local multi-table host (wraps RoomManager).
 */
@Injectable()
export class RoomsService implements OnModuleInit {
  private manager!: RoomManager;

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
}
