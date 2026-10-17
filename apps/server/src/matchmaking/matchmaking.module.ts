import { Module } from '@nestjs/common';
import { RoomsModule } from '../rooms/rooms.module.js';
import { MatchmakingService } from './matchmaking.service.js';

@Module({
  imports: [RoomsModule],
  providers: [MatchmakingService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
