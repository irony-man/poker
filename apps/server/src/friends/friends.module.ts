import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  imports: [forwardRef(() => AuthModule), RoomsModule],
  controllers: [FriendsController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
