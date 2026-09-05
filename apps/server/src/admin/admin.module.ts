import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AdminGuard } from '../common/admin.guard.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { HistoryModule } from '../history/history.module.js';
import { LudoModule } from '../ludo/ludo.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { AdminController } from './admin.controller.js';

@Module({
  imports: [
    AuthModule,
    WalletModule,
    RoomsModule,
    LudoModule,
    ContestsModule,
    FriendsModule,
    HistoryModule,
    SiteConfigModule,
  ],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
