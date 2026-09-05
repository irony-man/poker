import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { LudoController } from './ludo.controller.js';
import { LudoRoomsService } from './ludo.service.js';

@Module({
  imports: [
    RoomsModule,
    ContestsModule,
    SiteConfigModule,
    forwardRef(() => FriendsModule),
    forwardRef(() => AuthModule),
  ],
  controllers: [LudoController],
  providers: [LudoRoomsService],
  exports: [LudoRoomsService],
})
export class LudoModule {}
