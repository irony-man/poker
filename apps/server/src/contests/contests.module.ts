import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FriendsModule } from '../friends/friends.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { WalletModule } from '../wallet/wallet.module.js';
import { ContestsController } from './contests.controller.js';
import { ContestsService } from './contests.service.js';

@Module({
  imports: [
    RoomsModule,
    forwardRef(() => WalletModule),
    forwardRef(() => AuthModule),
    forwardRef(() => FriendsModule),
  ],
  controllers: [ContestsController],
  providers: [ContestsService],
  exports: [ContestsService],
})
export class ContestsModule {}
