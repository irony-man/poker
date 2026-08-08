import { Injectable, OnModuleInit } from '@nestjs/common';
import { RoomsService } from '../rooms/rooms.service.js';
import { ensurePublicTables } from './public-tables.js';

@Injectable()
export class PublicTablesBootstrap implements OnModuleInit {
  constructor(private readonly rooms: RoomsService) {}

  onModuleInit(): void {
    ensurePublicTables(this.rooms.asManager());
  }
}
