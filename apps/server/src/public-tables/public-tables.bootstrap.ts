import { Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { RealtimeService } from '../realtime/realtime.service.js';
import { RoomsService } from '../rooms/rooms.service.js';
import { ensurePublicTables } from './public-tables.js';

@Injectable()
export class PublicTablesBootstrap implements OnModuleInit {
  constructor(
    private readonly rooms: RoomsService,
    @Optional() private readonly realtime?: RealtimeService,
  ) {}

  onModuleInit(): void {
    ensurePublicTables(this.rooms.asManager());
    this.realtime?.setPublicTables(this.rooms.listPublicLobby());
  }
}
