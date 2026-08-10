import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ContestsModule } from '../contests/contests.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PokerGateway } from './poker.gateway.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => WalletModule),
    RoomsModule,
    ContestsModule,
    forwardRef(() => FriendsModule),
  ],
  providers: [PokerGateway],
})
export class GatewayModule {}
