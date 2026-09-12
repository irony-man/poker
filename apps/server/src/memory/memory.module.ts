import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { LudoModule } from '../ludo/ludo.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { SnakesModule } from '../snakes/snakes.module.js';
import { MemoryController } from './memory.controller.js';
import { MemoryRoomsService } from './memory.service.js';

@Module({
  imports: [
    RoomsModule,
    ContestsModule,
    LudoModule,
    SnakesModule,
    SiteConfigModule,
    forwardRef(() => FriendsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [MemoryController],
  providers: [MemoryRoomsService],
  exports: [MemoryRoomsService],
})
export class MemoryModule {}
