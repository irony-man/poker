import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ContestsService } from '../contests/contests.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import {
  LUDO_IDLE_SWEEP_MS,
  LUDO_INACTIVITY_MS,
  LudoRoomManager,
  type LudoMeta,
} from './ludo-room.js';

@Injectable()
export class LudoRoomsService implements OnModuleInit, OnModuleDestroy {
  private manager!: LudoRoomManager;
  private idleSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly rooms: RoomsService,
    private readonly contests: ContestsService,
    @Optional() private readonly site?: SiteConfigService,
  ) {}

  onModuleInit(): void {
    this.manager = new LudoRoomManager();
    this.manager.setExternalInviteTaken((code) => {
      return Boolean(this.rooms.getByInvite(code) || this.contests.getByInvite(code));
    });
    this.idleSweepTimer = setInterval(() => {
      const inactivityMs = this.site?.getRoomInactivityMs() ?? LUDO_INACTIVITY_MS;
      this.manager.terminateIdleRooms(Date.now(), inactivityMs);
    }, LUDO_IDLE_SWEEP_MS);
    this.idleSweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.idleSweepTimer) {
      clearInterval(this.idleSweepTimer);
      this.idleSweepTimer = null;
    }
  }

  asManager(): LudoRoomManager {
    return this.manager;
  }

  create(opts: {
    name: string;
    hostUserId: string;
    maxSeats: 2 | 3 | 4;
    inviteCode?: string;
    botCount?: number;
  }): LudoMeta {
    const meta = this.manager.create({
      name: opts.name,
      hostUserId: opts.hostUserId,
      maxSeats: opts.maxSeats,
      inviteCode: opts.inviteCode,
    });
    const room = this.manager.get(meta.id);
    const maxBots = Math.max(0, opts.maxSeats - 1);
    const bots = Math.min(opts.botCount ?? 0, maxBots);
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
