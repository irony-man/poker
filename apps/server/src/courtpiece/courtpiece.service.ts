import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import type { RulesVariant } from '@poker/courtpiece-engine';
import { ContestsService } from '../contests/contests.service.js';
import { LudoRoomsService } from '../ludo/ludo.service.js';
import { MemoryRoomsService } from '../memory/memory.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { SnakesRoomsService } from '../snakes/snakes.service.js';
import {
  COURTPIECE_IDLE_SWEEP_MS,
  COURTPIECE_INACTIVITY_MS,
  CourtpieceRoomManager,
  type CourtpieceMeta,
} from './courtpiece-room.js';

@Injectable()
export class CourtpieceRoomsService implements OnModuleInit, OnModuleDestroy {
  private manager!: CourtpieceRoomManager;
  private idleSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly rooms: RoomsService,
    private readonly contests: ContestsService,
    @Optional() private readonly ludo?: LudoRoomsService,
    @Optional() private readonly snakes?: SnakesRoomsService,
    @Optional() private readonly memory?: MemoryRoomsService,
    @Optional() private readonly site?: SiteConfigService,
  ) {}

  onModuleInit(): void {
    this.manager = new CourtpieceRoomManager();
    this.manager.setExternalInviteTaken((code) => {
      return Boolean(
        this.rooms.getByInvite(code) ||
          this.contests.getByInvite(code) ||
          this.ludo?.getByInvite(code) ||
          this.snakes?.getByInvite(code) ||
          this.memory?.getByInvite(code),
      );
    });
    this.idleSweepTimer = setInterval(() => {
      const inactivityMs = this.site?.getRoomInactivityMs() ?? COURTPIECE_INACTIVITY_MS;
      this.manager.terminateIdleRooms(Date.now(), inactivityMs);
    }, COURTPIECE_IDLE_SWEEP_MS);
    this.idleSweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
  }

  asManager(): CourtpieceRoomManager {
    return this.manager;
  }

  create(opts: {
    name: string;
    hostUserId: string;
    rulesVariant: RulesVariant;
    inviteCode?: string;
    botCount?: number;
  }): CourtpieceMeta {
    const meta = this.manager.create({
      name: opts.name,
      hostUserId: opts.hostUserId,
      rulesVariant: opts.rulesVariant,
      inviteCode: opts.inviteCode,
    });
    const room = this.manager.get(meta.id);
    const bots = Math.min(opts.botCount ?? 0, 3);
    if (room && bots > 0) {
      const seating = this.site?.getBotSeatingConfig();
      room.addBot(
        opts.hostUserId,
        undefined,
        bots,
        seating?.names,
        seating
          ? {
              defaultPersonality: seating.defaultPersonality,
              namePersonalities: seating.namePersonalities,
            }
          : undefined,
      );
    }
    return meta;
  }

  get(id: string) {
    return this.manager.get(id);
  }

  getByInvite(code: string) {
    return this.manager.getByInvite(code);
  }

  leaveUser(userId: string) {
    this.manager.leaveUser(userId);
  }
}
