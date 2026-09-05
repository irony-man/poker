import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { LudoModule } from '../ludo/ludo.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { SiteConfigModule } from '../site-config/site-config.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PokerGateway } from './poker.gateway.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => WalletModule),
    RoomsModule,
    ContestsModule,
    LudoModule,
    SiteConfigModule,
    forwardRef(() => FriendsModule),
  ],
  providers: [PokerGateway],
})
export class GatewayModule {}
