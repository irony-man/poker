import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { LudoModule } from '../ludo/ludo.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { SnakesController } from './snakes.controller.js';
import { SnakesRoomsService } from './snakes.service.js';

@Module({
  imports: [
    RoomsModule,
    ContestsModule,
    LudoModule,
    SiteConfigModule,
    forwardRef(() => FriendsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [SnakesController],
  providers: [SnakesRoomsService],
  exports: [SnakesRoomsService],
})
export class SnakesModule {}
