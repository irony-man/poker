import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { HistoryModule } from '../history/history.module.js';
import { MailModule } from '../mail/mail.module.js';
import { RoomsModule } from '../rooms/rooms.module.js';
import { FriendLinksController } from './friend-links.controller.js';
import { FriendsController } from './friends.controller.js';
import { FriendsService } from './friends.service.js';

@Module({
  imports: [forwardRef(() => AuthModule), RoomsModule, HistoryModule, MailModule],
  controllers: [FriendsController, FriendLinksController],
  providers: [FriendsService],
  exports: [FriendsService],
})
export class FriendsModule {}
