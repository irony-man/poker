import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { HistoryModule } from '../history/history.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { PublicUsersController } from './public-users.controller.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => WalletModule),
    forwardRef(() => FriendsModule),
    HistoryModule,
  ],
  controllers: [UsersController, PublicUsersController],
})
export class UsersModule {}
