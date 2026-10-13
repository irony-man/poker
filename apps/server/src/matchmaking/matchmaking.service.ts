import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { SiteConfigService } from '../site-config/site-config.service.js';
import { Matchmaker } from './matchmaker.js';

/** Nest wrapper around the process-local public poker queue. */
@Injectable()
export class MatchmakingService implements OnModuleDestroy {
  private matchmaker: Matchmaker | null = null;

  constructor(
    private readonly rooms: RoomsService,
    private readonly site: SiteConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Lazy: RoomsService builds its RoomManager in its own onModuleInit. */
  private get mm(): Matchmaker {
    if (!this.matchmaker) {
      this.matchmaker = new Matchmaker({
        rooms: this.rooms.asManager(),
        timings: () => this.site.getPublicTableTimings(),
        botSeating: () => this.site.getBotSeatingConfig(),
        sendToUser: (userId, msg) => this.realtime.sendToUser(userId, msg),
      });
    }
    return this.matchmaker;
  }

  join(userId: string, name: string, stakeId?: string): void {
    this.mm.join(userId, name, stakeId);
  }

  cancel(userId: string): boolean {
    return this.mm.cancel(userId);
  }

  onModuleDestroy(): void {
    this.matchmaker?.dispose();
  }
}
