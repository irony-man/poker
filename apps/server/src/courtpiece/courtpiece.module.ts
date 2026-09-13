import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { LudoModule } from '../ludo/ludo.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { SnakesModule } from '../snakes/snakes.module.js';
import { CourtpieceController } from './courtpiece.controller.js';
import { CourtpieceRoomsService } from './courtpiece.service.js';

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
  controllers: [CourtpieceController],
  providers: [CourtpieceRoomsService],
  exports: [CourtpieceRoomsService],
})
export class CourtpieceModule {}
